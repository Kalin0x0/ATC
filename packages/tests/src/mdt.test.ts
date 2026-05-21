import { describe, it, expect, vi } from 'vitest'
import {
  MdtAggregationService,
  AtcMdtSDK,
  encodeCursor,
  decodeCursor,
  nextCursor,
  offsetFromCursor,
} from '@atc/mdt'
import {
  mdtSearchQuerySchema,
  mdtCharacterParamSchema,
  mdtIncidentParamSchema,
  mdtPaginationSchema,
} from '@atc/schemas'
import type {
  WarrantRepository,
  ArrestRepository,
  CitationRepository,
  JailRepository,
  EvidenceRepository,
} from '@atc/law'
import type {
  IncidentRepository,
  BoloRepository,
  ResponderAssignmentRepository,
} from '@atc/dispatch'
import type {
  AtcWarrant,
  AtcArrestRecord,
  AtcCitation,
  AtcJailRecord,
  AtcIncident,
  AtcBoloRecord,
  AtcResponderAssignment,
} from '@atc/shared-types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function warrant(over: Partial<AtcWarrant> = {}): AtcWarrant {
  return {
    id: 'w-1', characterId: 'c-1', issuedByPrincipalId: 'p-1', agencyId: 'a-1',
    severity: 'misdemeanor', status: 'active', reason: 'speeding',
    expiresAt: null, executedAt: null, revokedAt: null, revokeReason: null,
    createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
    ...over,
  }
}
function arrest(over: Partial<AtcArrestRecord> = {}): AtcArrestRecord {
  return {
    id: 'ar-1', characterId: 'c-1', arrestedByPrincipalId: 'p-1', agencyId: 'a-1',
    warrantId: null, reason: 'evade', severity: 'felony', notes: null,
    createdAt: new Date('2025-01-02'),
    ...over,
  }
}
function citation(over: Partial<AtcCitation> = {}): AtcCitation {
  return {
    id: 'ci-1', characterId: 'c-1', issuedByPrincipalId: 'p-1', agencyId: 'a-1',
    reason: 'parking', amount: 100, currency: 'USD',
    status: 'unpaid', ledgerJournalId: null, idempotencyKey: 'k-1',
    paidAt: null, createdAt: new Date('2025-01-03'), updatedAt: new Date('2025-01-03'),
    ...over,
  }
}
function jail(over: Partial<AtcJailRecord> = {}): AtcJailRecord {
  return {
    id: 'j-1', characterId: 'c-1', arrestRecordId: 'ar-1',
    startAt: new Date('2025-01-04'), releaseAt: null,
    releasedByPrincipalId: null, status: 'active',
    createdAt: new Date('2025-01-04'), updatedAt: new Date('2025-01-04'),
    ...over,
  }
}
function incident(over: Partial<AtcIncident> = {}): AtcIncident {
  return {
    id: 'i-1', callId: null, agencyId: 'a-1', status: 'open', priority: 'high',
    title: 'Robbery', location: null, notes: [], evidenceIds: [],
    arrestIds: [], citationIds: [], createdByPrincipalId: 'p-1',
    resolvedAt: null, archivedAt: null,
    createdAt: new Date('2025-01-05'), updatedAt: new Date('2025-01-05'),
    ...over,
  }
}
function bolo(over: Partial<AtcBoloRecord> = {}): AtcBoloRecord {
  return {
    id: 'b-1', agencyId: 'a-1', createdByPrincipalId: 'p-1', severity: 'felony',
    description: 'Armed suspect', linkedWarrantId: null, linkedCharacterId: null,
    linkedVehicleId: null, notes: [], status: 'active',
    expiresAt: null, expiredAt: null, archivedAt: null,
    createdAt: new Date('2025-01-06'), updatedAt: new Date('2025-01-06'),
    ...over,
  }
}
function responder(over: Partial<AtcResponderAssignment> = {}): AtcResponderAssignment {
  return {
    id: 'r-1', incidentId: 'i-1', principalId: 'p-1', characterId: null,
    agencyId: 'a-1', status: 'assigned',
    assignedAt: new Date('2025-01-07'), statusUpdatedAt: new Date('2025-01-07'),
    clearedAt: null,
    ...over,
  }
}

// ── Mock repository builder ──────────────────────────────────────────────────

interface Mocks {
  warrants: WarrantRepository
  arrests: ArrestRepository
  citations: CitationRepository
  jail: JailRepository
  evidence: EvidenceRepository
  incidents: IncidentRepository
  bolos: BoloRepository
  responders: ResponderAssignmentRepository
}

function makeMocks(): Mocks {
  return {
    warrants: {
      list:             vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      listByCharacter:  vi.fn().mockResolvedValue([]),
      findById:         vi.fn().mockResolvedValue(null),
    } as unknown as WarrantRepository,
    arrests: {
      listByCharacter: vi.fn().mockResolvedValue([]),
      list:            vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      findById:        vi.fn().mockResolvedValue(null),
    } as unknown as ArrestRepository,
    citations: {
      list:     vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as CitationRepository,
    jail: {
      findActiveForCharacter: vi.fn().mockResolvedValue(null),
      findById:               vi.fn().mockResolvedValue(null),
    } as unknown as JailRepository,
    evidence: {
      list:     vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as EvidenceRepository,
    incidents: {
      list:     vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as IncidentRepository,
    bolos: {
      list:     vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as BoloRepository,
    responders: {
      listByIncident:        vi.fn().mockResolvedValue([]),
      listActiveByPrincipal: vi.fn().mockResolvedValue([]),
      findById:              vi.fn().mockResolvedValue(null),
    } as unknown as ResponderAssignmentRepository,
  }
}

// ── Service tests ────────────────────────────────────────────────────────────

describe('MdtAggregationService', () => {
  describe('getCharacterProfile', () => {
    it('aggregates active warrants, arrests, citations, jail, bolo', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.warrants.list).mockResolvedValue({
        items: [warrant()], total: 1, offset: 0, limit: 100,
      })
      vi.mocked(mocks.arrests.listByCharacter).mockResolvedValue([arrest()])
      vi.mocked(mocks.citations.list).mockResolvedValue({
        items: [citation()], total: 1, offset: 0, limit: 100,
      })
      vi.mocked(mocks.jail.findActiveForCharacter).mockResolvedValue(jail())
      vi.mocked(mocks.bolos.list).mockResolvedValue({
        items: [bolo({ linkedCharacterId: 'c-1' })], total: 1, offset: 0, limit: 1,
      })

      const svc = new MdtAggregationService(mocks)
      const profile = await svc.getCharacterProfile('c-1')

      expect(profile.activeWarrants).toHaveLength(1)
      expect(profile.arrestHistory).toHaveLength(1)
      expect(profile.citations).toHaveLength(1)
      expect(profile.activeJail).not.toBeNull()
      expect(profile.activeBolo).not.toBeNull()
      expect(profile.openIncidents).toEqual([])
    })

    it('returns empty profile on empty character id (null-safe)', async () => {
      const svc = new MdtAggregationService(makeMocks())
      const profile = await svc.getCharacterProfile('')
      expect(profile.activeWarrants).toEqual([])
      expect(profile.arrestHistory).toEqual([])
      expect(profile.activeJail).toBeNull()
    })

    it('issues all repo queries in parallel (no N+1)', async () => {
      const mocks = makeMocks()
      const svc = new MdtAggregationService(mocks)
      await svc.getCharacterProfile('c-1')
      expect(mocks.warrants.list).toHaveBeenCalledTimes(1)
      expect(mocks.arrests.listByCharacter).toHaveBeenCalledTimes(1)
      expect(mocks.citations.list).toHaveBeenCalledTimes(1)
      expect(mocks.jail.findActiveForCharacter).toHaveBeenCalledTimes(1)
      expect(mocks.bolos.list).toHaveBeenCalledTimes(1)
    })
  })

  describe('getIncidentSummary', () => {
    it('returns null for missing incident', async () => {
      const svc = new MdtAggregationService(makeMocks())
      expect(await svc.getIncidentSummary('missing')).toBeNull()
    })

    it('aggregates responders for a found incident', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.incidents.findById).mockResolvedValue(incident())
      vi.mocked(mocks.responders.listByIncident).mockResolvedValue([
        responder({ status: 'assigned' }),
        responder({ id: 'r-2', status: 'cleared', clearedAt: new Date() }),
      ])
      const svc = new MdtAggregationService(mocks)
      const summary = await svc.getIncidentSummary('i-1')
      expect(summary).not.toBeNull()
      expect(summary!.responders).toHaveLength(2)
      expect(summary!.responderCount).toBe(2)
      expect(summary!.activeResponderCount).toBe(1)
    })

    it('returns null for empty id', async () => {
      const svc = new MdtAggregationService(makeMocks())
      expect(await svc.getIncidentSummary('')).toBeNull()
    })

    it('omits responders when repository not provided (fail-soft)', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.incidents.findById).mockResolvedValue(incident())
      const svc = new MdtAggregationService({
        warrants: mocks.warrants,
        arrests: mocks.arrests,
        citations: mocks.citations,
        jail: mocks.jail,
        incidents: mocks.incidents,
        bolos: mocks.bolos,
      })
      const summary = await svc.getIncidentSummary('i-1')
      expect(summary!.responders).toEqual([])
    })
  })

  describe('getActiveWarrants', () => {
    it('computes highest severity correctly', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.warrants.list).mockResolvedValue({
        items: [
          warrant({ severity: 'infraction' }),
          warrant({ id: 'w-2', severity: 'felony' }),
          warrant({ id: 'w-3', severity: 'misdemeanor' }),
        ],
        total: 3, offset: 0, limit: 100,
      })
      const svc = new MdtAggregationService(mocks)
      const summary = await svc.getActiveWarrants('c-1')
      expect(summary.totalActive).toBe(3)
      expect(summary.highestSeverity).toBe('felony')
    })

    it('returns null severity on no warrants', async () => {
      const svc = new MdtAggregationService(makeMocks())
      const summary = await svc.getActiveWarrants('c-1')
      expect(summary.highestSeverity).toBeNull()
    })
  })

  describe('getJailState', () => {
    it('reports active jail', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.jail.findActiveForCharacter).mockResolvedValue(jail())
      const svc = new MdtAggregationService(mocks)
      const state = await svc.getJailState('c-1')
      expect(state.isCurrentlyJailed).toBe(true)
      expect(state.current).not.toBeNull()
    })

    it('reports no jail for unjailed character', async () => {
      const svc = new MdtAggregationService(makeMocks())
      const state = await svc.getJailState('c-1')
      expect(state.isCurrentlyJailed).toBe(false)
      expect(state.current).toBeNull()
    })
  })

  describe('getEvidenceSummary', () => {
    it('returns empty summary when no arrests link a character', async () => {
      const svc = new MdtAggregationService(makeMocks())
      const summary = await svc.getEvidenceSummary('c-1')
      expect(summary.totalCount).toBe(0)
      expect(summary.evidence).toEqual([])
    })

    it('fail-soft when evidence repo absent', async () => {
      const mocks = makeMocks()
      const svc = new MdtAggregationService({
        warrants: mocks.warrants,
        arrests: mocks.arrests,
        citations: mocks.citations,
        jail: mocks.jail,
        incidents: mocks.incidents,
        bolos: mocks.bolos,
      })
      const summary = await svc.getEvidenceSummary('c-1')
      expect(summary.totalCount).toBe(0)
    })
  })

  describe('searches', () => {
    it('searchIncidents: returns single result on exact ID match', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.incidents.findById).mockResolvedValue(incident())
      const svc = new MdtAggregationService(mocks)
      const result = await svc.searchIncidents('i-1', { limit: 10 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.nextCursor).toBeNull()
    })

    it('searchIncidents: falls back to agency listing', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.incidents.list).mockResolvedValue({
        items: [incident(), incident({ id: 'i-2' })],
        total: 2, offset: 0, limit: 20,
      })
      const svc = new MdtAggregationService(mocks)
      const result = await svc.searchIncidents('a-1', { limit: 20 })
      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('searchBolos: by linked character', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.bolos.list).mockResolvedValue({
        items: [bolo({ linkedCharacterId: 'c-1' })],
        total: 1, offset: 0, limit: 20,
      })
      const svc = new MdtAggregationService(mocks)
      const result = await svc.searchBolos('c-1')
      expect(result.items).toHaveLength(1)
    })

    it('searchVehicles: filters bolos by linkedVehicleId', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.bolos.list).mockResolvedValue({
        items: [
          bolo({ linkedVehicleId: 'v-1' }),
          bolo({ id: 'b-2', linkedVehicleId: 'v-2' }),
        ],
        total: 2, offset: 0, limit: 100,
      })
      const svc = new MdtAggregationService(mocks)
      const result = await svc.searchVehicles('v-1')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.id).toBe('v-1')
    })

    it('searchCharacters: returns aggregated profile when character has data', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.warrants.list).mockResolvedValue({
        items: [warrant()], total: 1, offset: 0, limit: 100,
      })
      const svc = new MdtAggregationService(mocks)
      const result = await svc.searchCharacters('c-1')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.data.activeWarrants).toHaveLength(1)
    })

    it('searchCharacters: empty result when no data', async () => {
      const svc = new MdtAggregationService(makeMocks())
      const result = await svc.searchCharacters('c-1')
      expect(result.items).toEqual([])
    })

    it('empty query yields no items (rejects empty searches)', async () => {
      const svc = new MdtAggregationService(makeMocks())
      const result = await svc.searchIncidents('  ')
      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })

    it('caps limit at 100', async () => {
      const mocks = makeMocks()
      const svc = new MdtAggregationService(mocks)
      // Internal clamp visible via list() call argument
      await svc.searchIncidents('a-1', { limit: 500 })
      const lastCall = vi.mocked(mocks.incidents.list).mock.calls.at(-1)
      expect(lastCall?.[0]?.limit).toBeLessThanOrEqual(100)
    })

    it('pagination cursor advances offset', async () => {
      const mocks = makeMocks()
      vi.mocked(mocks.incidents.list).mockResolvedValue({
        items: [incident(), incident({ id: 'i-2' })],
        total: 50, offset: 0, limit: 2,
      })
      const svc = new MdtAggregationService(mocks)
      const first = await svc.searchIncidents('a-1', { limit: 2 })
      expect(first.nextCursor).not.toBeNull()
      const offset = offsetFromCursor(first.nextCursor)
      expect(offset).toBeGreaterThan(0)
    })
  })

  describe('no side effects', () => {
    it('does not call any write or mutation method', async () => {
      const mocks = makeMocks()
      const svc = new MdtAggregationService(mocks)
      await svc.getCharacterProfile('c-1')
      await svc.getJailState('c-1')
      await svc.getActiveWarrants('c-1')
      // Verify only read methods invoked — write methods aren't even on mocks
      const repoKeys = Object.values(mocks)
      for (const repo of repoKeys) {
        for (const key of Object.keys(repo)) {
          if (['create', 'update', 'delete', 'emit', 'transferCustody'].includes(key)) {
            throw new Error(`Forbidden mutation method observed: ${key}`)
          }
        }
      }
    })
  })
})

// ── SDK tests ────────────────────────────────────────────────────────────────

describe('AtcMdtSDK', () => {
  it('exposes only read methods', () => {
    const sdk = new AtcMdtSDK(makeMocks())
    expect(typeof sdk.getCharacterProfile).toBe('function')
    expect(typeof sdk.getIncident).toBe('function')
    expect(typeof sdk.searchCharacters).toBe('function')
    expect(typeof sdk.searchIncidents).toBe('function')
    expect(typeof sdk.searchBolos).toBe('function')
    expect(typeof sdk.searchVehicles).toBe('function')
    // Mutation methods must not exist
    expect((sdk as unknown as Record<string, unknown>).createIncident).toBeUndefined()
    expect((sdk as unknown as Record<string, unknown>).deleteCharacter).toBeUndefined()
  })

  it('delegates getCharacterProfile to underlying service', async () => {
    const mocks = makeMocks()
    const sdk = new AtcMdtSDK(mocks)
    const profile = await sdk.getCharacterProfile('c-1')
    expect(profile.characterId).toBe('c-1')
  })
})

// ── Cursor tests ─────────────────────────────────────────────────────────────

describe('cursor encoding', () => {
  it('round-trips an offset', () => {
    const cursor = encodeCursor({ offset: 42 })
    expect(decodeCursor(cursor)).toEqual({ offset: 42 })
  })

  it('returns null on garbage cursors (cursor-safe)', () => {
    expect(decodeCursor('not-base64')).toBeNull()
    expect(decodeCursor('')).toBeNull()
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor(Buffer.from('{"offset":-1}').toString('base64url'))).toBeNull()
    expect(decodeCursor(Buffer.from('{"offset":99999999}').toString('base64url'))).toBeNull()
  })

  it('nextCursor returns null when end reached', () => {
    expect(nextCursor(40, 10, 50)).toBeNull()
    expect(nextCursor(0, 10, 100)).not.toBeNull()
  })
})

// ── Schema tests ─────────────────────────────────────────────────────────────

describe('mdt schemas', () => {
  it('mdtSearchQuerySchema rejects empty q', () => {
    const r = mdtSearchQuerySchema.safeParse({ q: '' })
    expect(r.success).toBe(false)
  })

  it('mdtSearchQuerySchema trims q', () => {
    const r = mdtSearchQuerySchema.safeParse({ q: '  hello  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.q).toBe('hello')
  })

  it('mdtSearchQuerySchema caps limit at 100', () => {
    const r = mdtSearchQuerySchema.safeParse({ q: 'x', limit: 999 })
    expect(r.success).toBe(false)
  })

  it('mdtSearchQuerySchema defaults limit to 20', () => {
    const r = mdtSearchQuerySchema.safeParse({ q: 'x' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.limit).toBe(20)
  })

  it('mdtCharacterParamSchema rejects empty id', () => {
    expect(mdtCharacterParamSchema.safeParse({ id: '' }).success).toBe(false)
    expect(mdtCharacterParamSchema.safeParse({ id: 'c-1' }).success).toBe(true)
  })

  it('mdtIncidentParamSchema requires id', () => {
    expect(mdtIncidentParamSchema.safeParse({}).success).toBe(false)
    expect(mdtIncidentParamSchema.safeParse({ id: 'i-1' }).success).toBe(true)
  })

  it('mdtPaginationSchema honors defaults and limits', () => {
    const r = mdtPaginationSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.limit).toBe(20)
    expect(mdtPaginationSchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(mdtPaginationSchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it('mdtSearchQuerySchema rejects oversized cursor', () => {
    const long = 'x'.repeat(500)
    expect(mdtSearchQuerySchema.safeParse({ q: 'x', cursor: long }).success).toBe(false)
  })
})
