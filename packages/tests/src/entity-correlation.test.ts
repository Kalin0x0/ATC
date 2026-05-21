import { describe, it, expect, vi } from 'vitest'
import {
  RelationshipProjectionService,
  CorrelationIngestService,
  EntityCorrelationService,
  TemporalGraphService,
  AtcEntityIntelligenceSDK,
  CORRELATION_LIMITS,
} from '@atc/entity-correlation'
import { AtcEventBus } from '@atc/events'
import { ATC_LAW_EVENTS, ATC_DISPATCH_EVENTS, ATC_JOB_EVENTS } from '@atc/shared-types'
import {
  correlationTimelineQuerySchema,
  correlationAssociatesQuerySchema,
  correlationHistoricalGraphQuerySchema,
} from '@atc/schemas'
import type {
  EntityRegistryRepository,
  RelationshipRepository,
} from '@atc/entity-graph'
import type {
  AtcEntityNode,
  AtcRelationshipEdge,
  AtcEntityType,
} from '@atc/shared-types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function node(id: string, type: AtcEntityType = 'character', over: Partial<AtcEntityNode> = {}): AtcEntityNode {
  return {
    id, externalId: id, type,
    displayName: id, sourceSystem: 'test', visibility: 'public',
    metadata: null, createdBy: null,
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    aliases: [], ...over,
  }
}

function edge(id: string, from: string, to: string, kind: AtcRelationshipEdge['relationship'] = 'character_associated_with_character'): AtcRelationshipEdge {
  return {
    id, from: { id: from, externalId: from, type: 'character' },
    to: { id: to, externalId: to, type: 'character' },
    relationship: kind, weight: 1,
    sourceSystem: 'test', attribution: null, metadata: null,
    observedAt: new Date('2026-01-05'), endedAt: null, isActive: true,
  }
}

// ── Mock repos ───────────────────────────────────────────────────────────────

function makeRegistry(nodes: AtcEntityNode[]): EntityRegistryRepository {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const byExt = new Map(nodes.map((n) => [`${n.type}:${n.externalId}`, n]))
  return {
    findById: vi.fn(async (id: string) => byId.get(id) ?? null),
    findByTypeAndExternalId: vi.fn(async (t: AtcEntityType, e: string) => byExt.get(`${t}:${e}`) ?? null),
    register: vi.fn(async (p: { type: AtcEntityType; externalId: string }) => {
      const existing = byExt.get(`${p.type}:${p.externalId}`)
      if (existing) return existing
      const fresh = node(`reg-${p.externalId}`, p.type)
      byId.set(fresh.id, fresh)
      byExt.set(`${p.type}:${p.externalId}`, fresh)
      return fresh
    }),
    list: vi.fn(async () => ({ items: [], total: 0, offset: 0, limit: 20 })),
    listAliases: vi.fn(async () => []),
    addAlias: vi.fn(async () => { throw new Error('stub') }),
    search: vi.fn(async () => ({ items: [], total: 0, offset: 0, limit: 20, hits: [] })),
  } as unknown as EntityRegistryRepository
}

function makeRelationships(edges: AtcRelationshipEdge[]): RelationshipRepository {
  const store = [...edges]
  return {
    recordEdge: vi.fn(async (p: { fromEntityId: string; toEntityId: string; relationship: AtcRelationshipEdge['relationship'] }) => {
      const e = edge(`new-${store.length}`, p.fromEntityId, p.toEntityId, p.relationship)
      store.push(e)
      return e
    }),
    list: vi.fn(async (params: { entityId: string; direction?: string; relationship?: string; includeEnded?: boolean }) => {
      const filtered = store.filter((e) => {
        if (params.relationship && e.relationship !== params.relationship) return false
        if (!params.includeEnded && e.endedAt) return false
        if (params.direction === 'outbound') return e.from.id === params.entityId
        if (params.direction === 'inbound')  return e.to.id   === params.entityId
        return e.from.id === params.entityId || e.to.id === params.entityId
      })
      return { items: filtered, total: filtered.length, offset: 0, limit: 100 }
    }),
    listForEntities: vi.fn(async (ids: string[]) =>
      store.filter((e) => ids.includes(e.from.id) || ids.includes(e.to.id))),
    findById: vi.fn(async () => null),
    endEdge: vi.fn(async (id: string) => {
      const e = store.find((x) => x.id === id)
      if (e) (e as { endedAt: Date | null }).endedAt = new Date()
    }),
  } as unknown as RelationshipRepository
}

// ── RelationshipProjectionService ────────────────────────────────────────────

describe('RelationshipProjectionService', () => {
  it('creates an edge when neither side exists', async () => {
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const svc = new RelationshipProjectionService({ registry, relationships: rels })
    const edge = await svc.project({
      from: { type: 'character', externalId: 'c-1' },
      to:   { type: 'warrant',   externalId: 'w-1' },
      relationship: 'character_subject_of_warrant',
    })
    expect(edge).not.toBeNull()
    expect(rels.recordEdge).toHaveBeenCalledTimes(1)
  })

  it('suppresses duplicate active edges', async () => {
    const cNode = node('reg-c-1', 'character')
    const wNode = node('reg-w-1', 'warrant')
    const existing = edge('e-1', cNode.id, wNode.id, 'character_subject_of_warrant')
    const registry = makeRegistry([cNode, wNode])
    // Custom registry that maps c-1 → cNode
    vi.mocked(registry.register).mockImplementation(async (p) => {
      if (p.externalId === 'c-1') return cNode
      if (p.externalId === 'w-1') return wNode
      return cNode
    })
    const rels = makeRelationships([existing])
    const svc = new RelationshipProjectionService({ registry, relationships: rels })
    const result = await svc.project({
      from: { type: 'character', externalId: 'c-1' },
      to:   { type: 'warrant',   externalId: 'w-1' },
      relationship: 'character_subject_of_warrant',
    })
    expect(result).toBeNull()
    expect(rels.recordEdge).not.toHaveBeenCalled()
  })

  it('fails soft on registry error', async () => {
    const registry = makeRegistry([])
    vi.mocked(registry.register).mockRejectedValue(new Error('boom'))
    const rels = makeRelationships([])
    const svc = new RelationshipProjectionService({ registry, relationships: rels })
    const result = await svc.project({
      from: { type: 'character', externalId: 'c-1' },
      to:   { type: 'warrant',   externalId: 'w-1' },
      relationship: 'character_subject_of_warrant',
    })
    expect(result).toBeNull()
  })

  it('endProjection closes an active matching edge', async () => {
    const cNode = node('reg-c-1', 'character')
    const incidentNode = node('reg-i-1', 'incident')
    const active = edge('a-1', cNode.id, incidentNode.id, 'character_involved_in_incident')
    const registry = makeRegistry([cNode, incidentNode])
    vi.mocked(registry.findByTypeAndExternalId).mockImplementation(async (t, e) => {
      if (t === 'character' && e === 'c-1') return cNode
      if (t === 'incident'  && e === 'i-1') return incidentNode
      return null
    })
    const rels = makeRelationships([active])
    const svc = new RelationshipProjectionService({ registry, relationships: rels })
    await svc.endProjection({
      from: { type: 'character', externalId: 'c-1' },
      to:   { type: 'incident',  externalId: 'i-1' },
      relationship: 'character_involved_in_incident',
    })
    expect(rels.endEdge).toHaveBeenCalled()
  })

  it('endProjection silently no-ops when endpoints missing', async () => {
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const svc = new RelationshipProjectionService({ registry, relationships: rels })
    await svc.endProjection({
      from: { type: 'character', externalId: 'missing' },
      to:   { type: 'incident',  externalId: 'missing' },
      relationship: 'character_involved_in_incident',
    })
    expect(rels.endEdge).not.toHaveBeenCalled()
  })
})

// ── CorrelationIngestService ─────────────────────────────────────────────────

describe('CorrelationIngestService', () => {
  it('subscribes to all expected event types', () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const projection = new RelationshipProjectionService({ registry, relationships: rels })
    const ingest = new CorrelationIngestService({ projection, eventBus: bus })
    ingest.start()
    expect(ingest.subscriptionCount).toBeGreaterThan(5)
  })

  it('translates ARREST_RECORDED into a projection call', async () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const projection = new RelationshipProjectionService({ registry, relationships: rels })
    const spy = vi.spyOn(projection, 'project')
    new CorrelationIngestService({ projection, eventBus: bus }).start()
    await bus.emit(ATC_LAW_EVENTS.ARREST_RECORDED, { characterId: 'c-1', id: 'ar-1' })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('skips events without required fields (fail-soft)', async () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const projection = new RelationshipProjectionService({ registry, relationships: rels })
    const spy = vi.spyOn(projection, 'project')
    new CorrelationIngestService({ projection, eventBus: bus }).start()
    await bus.emit(ATC_LAW_EVENTS.ARREST_RECORDED, { /* missing characterId */ id: 'ar-1' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('responder cleared status triggers endProjection', async () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const projection = new RelationshipProjectionService({ registry, relationships: rels })
    const spy = vi.spyOn(projection, 'endProjection')
    new CorrelationIngestService({ projection, eventBus: bus }).start()
    await bus.emit(ATC_DISPATCH_EVENTS.RESPONDER_STATUS_CHANGED, {
      incidentId: 'i-1', characterId: 'c-1', status: 'cleared',
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('contract termination triggers endProjection', async () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const projection = new RelationshipProjectionService({ registry, relationships: rels })
    const spy = vi.spyOn(projection, 'endProjection')
    new CorrelationIngestService({ projection, eventBus: bus }).start()
    await bus.emit(ATC_JOB_EVENTS.CONTRACT_TERMINATED, {
      characterId: 'c-1', organizationId: 'org-1',
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes cleanly', () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    const registry = makeRegistry([])
    const rels = makeRelationships([])
    const projection = new RelationshipProjectionService({ registry, relationships: rels })
    const ingest = new CorrelationIngestService({ projection, eventBus: bus })
    const sub = ingest.start()
    expect(ingest.subscriptionCount).toBeGreaterThan(0)
    sub.unsubscribe()
    expect(ingest.subscriptionCount).toBe(0)
  })

  it('projection errors do not propagate to event bus', async () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    const registry = makeRegistry([])
    vi.mocked(registry.register).mockRejectedValue(new Error('boom'))
    const rels = makeRelationships([])
    const projection = new RelationshipProjectionService({ registry, relationships: rels })
    new CorrelationIngestService({ projection, eventBus: bus }).start()
    await expect(bus.emit(ATC_LAW_EVENTS.ARREST_RECORDED, { characterId: 'c-1', id: 'ar-1' }))
      .resolves.not.toThrow()
  })
})

// ── EntityCorrelationService ─────────────────────────────────────────────────

describe('EntityCorrelationService', () => {
  it('known associates filter to identity-type relationships', async () => {
    const root = node('e-1')
    const associate = node('e-2')
    const otherIncident = node('e-9', 'incident')
    const edges = [
      edge('r-1', 'e-1', 'e-2', 'character_associated_with_character'),
      edge('r-2', 'e-1', 'e-9', 'character_involved_in_incident'),
    ]
    const svc = new EntityCorrelationService({
      registry: makeRegistry([root, associate, otherIncident]),
      relationships: makeRelationships(edges),
    })
    const result = await svc.getKnownAssociates('e-1')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.confidence).toBeGreaterThan(0)
  })

  it('empty entity id returns empty associates', async () => {
    const svc = new EntityCorrelationService({
      registry: makeRegistry([]),
      relationships: makeRelationships([]),
    })
    expect(await svc.getKnownAssociates('')).toEqual([])
  })

  it('cluster bounded by max nodes', async () => {
    const root = node('e-1')
    const svc = new EntityCorrelationService({
      registry: makeRegistry([root]),
      relationships: makeRelationships([]),
    })
    const cluster = await svc.getCluster('e-1')
    expect(cluster.nodes).toHaveLength(1)
    expect(cluster.truncated).toBe(false)
  })

  it('cluster missing root returns empty', async () => {
    const svc = new EntityCorrelationService({
      registry: makeRegistry([]),
      relationships: makeRelationships([]),
    })
    const cluster = await svc.getCluster('missing')
    expect(cluster.size).toBe(0)
  })

  it('risk score factors warrants, arrests, incidents', async () => {
    const root = node('e-1')
    const edges = [
      edge('r-1', 'e-1', 'w-1', 'character_subject_of_warrant'),
      edge('r-2', 'e-1', 'a-1', 'character_subject_of_arrest'),
      edge('r-3', 'e-1', 'i-1', 'character_involved_in_incident'),
      edge('r-4', 'e-1', 'e-2', 'character_associated_with_character'),
    ]
    const svc = new EntityCorrelationService({
      registry: makeRegistry([root]),
      relationships: makeRelationships(edges),
    })
    const risk = await svc.computeRiskScore('e-1')
    expect(risk.factors.warrantCount).toBe(1)
    expect(risk.factors.arrestCount).toBe(1)
    expect(risk.factors.incidentDensity).toBe(1)
    expect(risk.factors.knownAssociatesCount).toBeGreaterThanOrEqual(1)
    expect(risk.score).toBeGreaterThan(0)
    expect(risk.score).toBeLessThanOrEqual(1)
  })

  it('risk score empty when entity not found', async () => {
    const svc = new EntityCorrelationService({
      registry: makeRegistry([]),
      relationships: makeRelationships([]),
    })
    const risk = await svc.computeRiskScore('missing')
    expect(risk.score).toBe(0)
  })
})

// ── TemporalGraphService ─────────────────────────────────────────────────────

describe('TemporalGraphService', () => {
  it('timeline includes creation entry', async () => {
    const root = node('e-1')
    const svc = new TemporalGraphService({
      registry: makeRegistry([root]),
      relationships: makeRelationships([]),
    })
    const page = await svc.getTimeline('e-1')
    expect(page.entries.length).toBeGreaterThan(0)
    expect(page.entries[0]!.kind).toBe('entity_registered')
  })

  it('timeline filters by since/until', async () => {
    const root = node('e-1')
    const e1 = edge('r-1', 'e-1', 'e-2')
    e1.observedAt = new Date('2026-02-01')
    const svc = new TemporalGraphService({
      registry: makeRegistry([root]),
      relationships: makeRelationships([e1]),
    })
    const page = await svc.getTimeline('e-1', { since: new Date('2026-01-15') })
    // Creation at 2026-01-01 should be excluded
    expect(page.entries.every((e) => e.at >= new Date('2026-01-15'))).toBe(true)
  })

  it('timeline missing root returns empty', async () => {
    const svc = new TemporalGraphService({
      registry: makeRegistry([]),
      relationships: makeRelationships([]),
    })
    const page = await svc.getTimeline('missing')
    expect(page.entries).toEqual([])
  })

  it('historical graph includes only edges active at asOf', async () => {
    const root = node('e-1')
    const e2 = node('e-2')
    const active = edge('r-active', 'e-1', 'e-2')
    active.observedAt = new Date('2026-01-01')
    const closed = edge('r-closed', 'e-1', 'e-2')
    closed.observedAt = new Date('2026-01-01')
    closed.endedAt = new Date('2026-01-10')
    const svc = new TemporalGraphService({
      registry: makeRegistry([root, e2]),
      relationships: makeRelationships([active, closed]),
    })
    // At 2026-01-05, both are active
    const before = await svc.getHistoricalGraph('e-1', new Date('2026-01-05'), 1)
    expect(before.edges).toHaveLength(2)
    // At 2026-01-15, closed should be excluded
    const after = await svc.getHistoricalGraph('e-1', new Date('2026-01-15'), 1)
    expect(after.edges).toHaveLength(1)
  })

  it('historical graph missing root returns empty', async () => {
    const svc = new TemporalGraphService({
      registry: makeRegistry([]),
      relationships: makeRelationships([]),
    })
    const g = await svc.getHistoricalGraph('missing', new Date())
    expect(g.nodes).toEqual([])
  })

  it('timeline pagination cursor advances', async () => {
    const root = node('e-1', 'character', {
      aliases: Array.from({ length: 30 }, (_, i) => ({
        id: `a-${i}`, entityId: 'e-1', kind: 'nickname' as const, value: `alias-${i}`,
        sourceSystem: 'test', createdBy: null, createdAt: new Date(`2026-01-${(i % 28) + 1}`),
      })),
    })
    const svc = new TemporalGraphService({
      registry: makeRegistry([root]),
      relationships: makeRelationships([]),
    })
    const first = await svc.getTimeline('e-1', { limit: 10 })
    expect(first.entries).toHaveLength(10)
    expect(first.nextCursor).not.toBeNull()
  })
})

// ── SDK ──────────────────────────────────────────────────────────────────────

describe('AtcEntityIntelligenceSDK', () => {
  it('exposes only the expected read methods', () => {
    const sdk = new AtcEntityIntelligenceSDK({
      registry: makeRegistry([]),
      relationships: makeRelationships([]),
    })
    expect(typeof sdk.getTimeline).toBe('function')
    expect(typeof sdk.getAssociates).toBe('function')
    expect(typeof sdk.getRisk).toBe('function')
    expect(typeof sdk.getClusters).toBe('function')
    expect(typeof sdk.getHistoricalGraph).toBe('function')
  })
})

// ── Schemas ──────────────────────────────────────────────────────────────────

describe('Phase 28 schemas', () => {
  it('timeline rejects oversize limit', () => {
    expect(correlationTimelineQuerySchema.safeParse({ limit: 999 }).success).toBe(false)
  })
  it('timeline accepts since/until dates', () => {
    const r = correlationTimelineQuerySchema.safeParse({ since: '2026-01-01' })
    expect(r.success).toBe(true)
  })
  it('associates limit default', () => {
    const r = correlationAssociatesQuerySchema.safeParse({})
    if (r.success) expect(r.data.limit).toBe(20)
  })
  it('historical graph requires asOf', () => {
    expect(correlationHistoricalGraphQuerySchema.safeParse({}).success).toBe(false)
    expect(correlationHistoricalGraphQuerySchema.safeParse({ asOf: '2026-01-01' }).success).toBe(true)
  })
  it('historical graph caps depth at 4', () => {
    expect(correlationHistoricalGraphQuerySchema.safeParse({ asOf: '2026-01-01', depth: 5 }).success).toBe(false)
  })
})

// ── Limits sanity ────────────────────────────────────────────────────────────

describe('CORRELATION_LIMITS', () => {
  it('hard caps are coherent', () => {
    expect(CORRELATION_LIMITS.MAX_DEPTH).toBeGreaterThanOrEqual(1)
    expect(CORRELATION_LIMITS.MAX_LIMIT).toBeLessThanOrEqual(100)
    expect(CORRELATION_LIMITS.MAX_NODES).toBeGreaterThan(CORRELATION_LIMITS.MAX_LIMIT)
  })
})
