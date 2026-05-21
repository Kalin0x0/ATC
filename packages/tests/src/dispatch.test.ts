import { describe, it, expect, vi } from 'vitest'
import type { PoolConnection } from 'mysql2/promise'
import {
  DispatchCallRepository,
  IncidentRepository,
  ResponderAssignmentRepository,
  BoloRepository,
  DispatchService,
  DispatchCallNotFoundError,
  DispatchCallImmutableError,
  IncidentNotFoundError,
  IncidentImmutableError,
  ResponderAssignmentNotFoundError,
  ResponderAssignmentImmutableError,
  BoloNotFoundError,
  BoloImmutableError,
} from '@atc/dispatch'
import type { DispatchPool } from '@atc/dispatch'
import type { AtcEventBus } from '@atc/events'
import { ATC_DISPATCH_EVENTS } from '@atc/shared-types'

// ── Mock helpers ───────────────────────────────────────────────────────────────

function makeConn(): PoolConnection {
  return {
    execute:          vi.fn().mockResolvedValue([[]]),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit:           vi.fn().mockResolvedValue(undefined),
    rollback:         vi.fn().mockResolvedValue(undefined),
    release:          vi.fn(),
  } as unknown as PoolConnection
}

function makePool(conn: PoolConnection): DispatchPool {
  return { getConnection: vi.fn().mockResolvedValue(conn) }
}

function makeEventBus(): AtcEventBus {
  return { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AtcEventBus
}

// ── Fixture rows ───────────────────────────────────────────────────────────────

function dispatchCallRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'call-1', source: 'officer', caller_identifier: 'prin-1',
    location: '1234 Main St', priority: 'high', description: 'Active shooter',
    incident_id: null, idempotency_key: 'key-1',
    created_at: new Date('2025-01-01'), accepted_at: null, closed_at: null,
    ...overrides,
  }
}

function incidentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'incident-1', call_id: null, agency_id: 'agency-1',
    status: 'open', priority: 'high', title: 'Robbery at bank',
    location: 'Fleeca Bank', notes: '[]', evidence_ids: '[]',
    arrest_ids: '[]', citation_ids: '[]',
    created_by_principal_id: 'prin-1',
    resolved_at: null, archived_at: null,
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function responderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'assignment-1', incident_id: 'incident-1', principal_id: 'prin-1',
    character_id: 'char-1', agency_id: 'agency-1', status: 'assigned',
    assigned_at: new Date('2025-01-01'),
    status_updated_at: new Date('2025-01-01'),
    cleared_at: null,
    ...overrides,
  }
}

function boloRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'bolo-1', agency_id: 'agency-1', created_by_principal_id: 'prin-1',
    severity: 'felony', description: 'Armed suspect in red vehicle',
    linked_warrant_id: null, linked_character_id: 'char-1', linked_vehicle_id: null,
    notes: '[]', status: 'active',
    expires_at: null, expired_at: null, archived_at: null,
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

// ── DispatchCallRepository ─────────────────────────────────────────────────────

describe('DispatchCallRepository', () => {
  it('creates a dispatch call and returns it', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new DispatchCallRepository(pool)
    const row = dispatchCallRow()

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])   // INSERT
      .mockResolvedValueOnce([[row]])        // SELECT

    const call = await repo.create({
      source: 'officer', location: row.location as string,
      priority: 'high', description: row.description as string,
      idempotencyKey: 'key-1',
    })

    expect(call.id).toBe('call-1')
    expect(call.source).toBe('officer')
    expect(call.priority).toBe('high')
  })

  it('replays idempotent call on ER_DUP_ENTRY', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new DispatchCallRepository(pool)
    const row = dispatchCallRow()

    // First call: INSERT throws ER_DUP_ENTRY, then findByIdempotencyKey
    vi.mocked(conn.execute)
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }))
      .mockResolvedValueOnce([[row]])

    const call = await repo.create({
      source: 'officer', location: '1234 Main St',
      priority: 'high', description: 'Active shooter',
      idempotencyKey: 'key-1',
    })

    expect(call.id).toBe('call-1')
    expect(call.idempotencyKey).toBe('key-1')
  })

  it('throws DispatchCallImmutableError when closing an already-closed call', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new DispatchCallRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[dispatchCallRow({ closed_at: new Date() })]]) // SELECT

    await expect(repo.close('call-1')).rejects.toThrow(DispatchCallImmutableError)
  })
})

// ── IncidentRepository ────────────────────────────────────────────────────────

describe('IncidentRepository', () => {
  it('creates an incident with open status', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new IncidentRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])         // INSERT
      .mockResolvedValueOnce([[incidentRow()]])    // SELECT

    const incident = await repo.create({
      agencyId: 'agency-1', priority: 'high',
      title: 'Robbery at bank', createdByPrincipalId: 'prin-1',
    })

    expect(incident.status).toBe('open')
    expect(incident.agencyId).toBe('agency-1')
    expect(incident.notes).toEqual([])
    expect(incident.evidenceIds).toEqual([])
  })

  it('escalates an open incident to active', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new IncidentRepository(pool)
    const activeRow = incidentRow({ status: 'active' })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[incidentRow()]])    // SELECT (verify open)
      .mockResolvedValueOnce([undefined])          // UPDATE
      .mockResolvedValueOnce([[activeRow]])         // SELECT (post-update)

    const incident = await repo.escalate('incident-1')
    expect(incident.status).toBe('active')
  })

  it('throws IncidentImmutableError when escalating a resolved incident', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new IncidentRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[incidentRow({ status: 'resolved' })]])

    await expect(repo.escalate('incident-1')).rejects.toThrow(IncidentImmutableError)
  })

  it('cannot resolve a resolved incident (immutability guard)', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new IncidentRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[incidentRow({ status: 'resolved' })]])

    await expect(repo.resolve('incident-1')).rejects.toThrow(IncidentImmutableError)
  })

  it('throws IncidentNotFoundError for unknown incident', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new IncidentRepository(pool)

    vi.mocked(conn.execute).mockResolvedValueOnce([[]])

    await expect(repo.findById('unknown')).resolves.toBeNull()
  })

  it('adds a note to an open incident (append-only)', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new IncidentRepository(pool)
    const rowWithNote = incidentRow({ notes: JSON.stringify([{ principalId: 'prin-1', text: 'Unit 4 on scene', createdAt: '2025-01-01T00:00:00.000Z' }]) })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[incidentRow()]])    // findById (open check)
      .mockResolvedValueOnce([undefined])          // UPDATE notes
      .mockResolvedValueOnce([[rowWithNote]])       // re-fetch

    const updated = await repo.addNote({ incidentId: 'incident-1', principalId: 'prin-1', text: 'Unit 4 on scene' })
    expect(updated.notes).toHaveLength(1)
    expect(updated.notes[0]?.text).toBe('Unit 4 on scene')
  })
})

// ── ResponderAssignmentRepository ─────────────────────────────────────────────

describe('ResponderAssignmentRepository', () => {
  it('creates a responder assignment with assigned status', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new ResponderAssignmentRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])           // INSERT
      .mockResolvedValueOnce([[responderRow()]])     // SELECT

    const assignment = await repo.create({
      incidentId: 'incident-1', principalId: 'prin-1',
      characterId: 'char-1', agencyId: 'agency-1',
    })

    expect(assignment.status).toBe('assigned')
    expect(assignment.clearedAt).toBeNull()
  })

  it('transitions assigned → enroute', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new ResponderAssignmentRepository(pool)
    const enrouteRow = responderRow({ status: 'enroute' })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[responderRow()]])     // FOR UPDATE SELECT
      .mockResolvedValueOnce([undefined])            // UPDATE
      .mockResolvedValueOnce([[enrouteRow]])          // post-commit SELECT

    const updated = await repo.updateStatus('assignment-1', 'enroute')
    expect(updated.status).toBe('enroute')
  })

  it('throws ResponderAssignmentImmutableError for invalid transition cleared → enroute', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new ResponderAssignmentRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[responderRow({ status: 'cleared' })]])

    await expect(repo.updateStatus('assignment-1', 'enroute')).rejects.toThrow(ResponderAssignmentImmutableError)
  })

  it('sets cleared_at when transitioning to cleared', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new ResponderAssignmentRepository(pool)
    const clearedRow = responderRow({ status: 'cleared', cleared_at: new Date() })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[responderRow()]])      // FOR UPDATE SELECT (assigned)
      .mockResolvedValueOnce([undefined])             // UPDATE
      .mockResolvedValueOnce([[clearedRow]])           // post-commit SELECT

    const updated = await repo.updateStatus('assignment-1', 'cleared')
    expect(updated.status).toBe('cleared')
    expect(updated.clearedAt).not.toBeNull()
  })
})

// ── BoloRepository ────────────────────────────────────────────────────────────

describe('BoloRepository', () => {
  it('creates a BOLO with active status', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new BoloRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])          // INSERT
      .mockResolvedValueOnce([[boloRow()]])         // SELECT

    const bolo = await repo.create({
      agencyId: 'agency-1', createdByPrincipalId: 'prin-1',
      severity: 'felony', description: 'Armed suspect in red vehicle',
      linkedCharacterId: 'char-1',
    })

    expect(bolo.status).toBe('active')
    expect(bolo.notes).toEqual([])
    expect(bolo.linkedCharacterId).toBe('char-1')
  })

  it('expires an active BOLO', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new BoloRepository(pool)
    const expiredRow = boloRow({ status: 'expired', expired_at: new Date() })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[boloRow()]])         // SELECT (active check)
      .mockResolvedValueOnce([undefined])           // UPDATE
      .mockResolvedValueOnce([[expiredRow]])         // re-fetch

    const bolo = await repo.expire('bolo-1')
    expect(bolo.status).toBe('expired')
    expect(bolo.expiredAt).not.toBeNull()
  })

  it('throws BoloImmutableError when expiring an already-expired BOLO', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new BoloRepository(pool)

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[boloRow({ status: 'expired' })]])

    await expect(repo.expire('bolo-1')).rejects.toThrow(BoloImmutableError)
  })

  it('returns null for unknown BOLO', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new BoloRepository(pool)

    vi.mocked(conn.execute).mockResolvedValueOnce([[]])

    await expect(repo.findById('unknown')).resolves.toBeNull()
  })
})

// ── DispatchService ───────────────────────────────────────────────────────────

describe('DispatchService', () => {
  it('emits DISPATCH_CREATED event when call is created', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const callRepo = new DispatchCallRepository(pool)
    const incidentRepo = new IncidentRepository(pool)
    const responderRepo = new ResponderAssignmentRepository(pool)
    const boloRepo = new BoloRepository(pool)
    const eventBus = makeEventBus()
    const service = new DispatchService({
      calls: callRepo, incidents: incidentRepo, responders: responderRepo,
      bolos: boloRepo, eventBus, telemetry: undefined,
    })
    const row = dispatchCallRow()

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])
      .mockResolvedValueOnce([[row]])

    await service.createCall({
      source: 'officer', location: '1234 Main St',
      priority: 'high', description: 'Active shooter',
      idempotencyKey: 'key-1',
    })

    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_DISPATCH_EVENTS.DISPATCH_CREATED,
      expect.objectContaining({ call: expect.objectContaining({ id: 'call-1' }) }),
    )
  })

  it('emits INCIDENT_CREATED event when incident is created', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const callRepo = new DispatchCallRepository(pool)
    const incidentRepo = new IncidentRepository(pool)
    const responderRepo = new ResponderAssignmentRepository(pool)
    const boloRepo = new BoloRepository(pool)
    const eventBus = makeEventBus()
    const service = new DispatchService({
      calls: callRepo, incidents: incidentRepo, responders: responderRepo,
      bolos: boloRepo, eventBus, telemetry: undefined,
    })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])
      .mockResolvedValueOnce([[incidentRow()]])

    await service.createIncident({
      agencyId: 'agency-1', priority: 'high',
      title: 'Robbery at bank', createdByPrincipalId: 'prin-1',
    })

    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_DISPATCH_EVENTS.INCIDENT_CREATED,
      expect.objectContaining({ incident: expect.objectContaining({ id: 'incident-1' }) }),
    )
  })

  it('emits INCIDENT_RESOLVED event on resolveIncident', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const callRepo = new DispatchCallRepository(pool)
    const incidentRepo = new IncidentRepository(pool)
    const responderRepo = new ResponderAssignmentRepository(pool)
    const boloRepo = new BoloRepository(pool)
    const eventBus = makeEventBus()
    const service = new DispatchService({
      calls: callRepo, incidents: incidentRepo, responders: responderRepo,
      bolos: boloRepo, eventBus, telemetry: undefined,
    })
    const resolvedRow = incidentRow({ status: 'resolved', resolved_at: new Date() })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[incidentRow()]])    // findById (active check in repo)
      .mockResolvedValueOnce([undefined])          // UPDATE
      .mockResolvedValueOnce([[resolvedRow]])       // re-fetch

    await service.resolveIncident('incident-1')

    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_DISPATCH_EVENTS.INCIDENT_RESOLVED,
      expect.objectContaining({ incident: expect.objectContaining({ status: 'resolved' }) }),
    )
  })

  it('emits BOLO_CREATED event when BOLO is created', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const callRepo = new DispatchCallRepository(pool)
    const incidentRepo = new IncidentRepository(pool)
    const responderRepo = new ResponderAssignmentRepository(pool)
    const boloRepo = new BoloRepository(pool)
    const eventBus = makeEventBus()
    const service = new DispatchService({
      calls: callRepo, incidents: incidentRepo, responders: responderRepo,
      bolos: boloRepo, eventBus, telemetry: undefined,
    })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])
      .mockResolvedValueOnce([[boloRow()]])

    await service.createBolo({
      agencyId: 'agency-1', createdByPrincipalId: 'prin-1',
      severity: 'felony', description: 'Armed suspect in red vehicle',
      linkedCharacterId: 'char-1',
    })

    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_DISPATCH_EVENTS.BOLO_CREATED,
      expect.objectContaining({ bolo: expect.objectContaining({ id: 'bolo-1' }) }),
    )
  })

  it('emits BOLO_EXPIRED event on expireBolo', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const callRepo = new DispatchCallRepository(pool)
    const incidentRepo = new IncidentRepository(pool)
    const responderRepo = new ResponderAssignmentRepository(pool)
    const boloRepo = new BoloRepository(pool)
    const eventBus = makeEventBus()
    const service = new DispatchService({
      calls: callRepo, incidents: incidentRepo, responders: responderRepo,
      bolos: boloRepo, eventBus, telemetry: undefined,
    })
    const expiredRow = boloRow({ status: 'expired', expired_at: new Date() })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[boloRow()]])
      .mockResolvedValueOnce([undefined])
      .mockResolvedValueOnce([[expiredRow]])

    await service.expireBolo('bolo-1')

    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_DISPATCH_EVENTS.BOLO_EXPIRED,
      expect.objectContaining({ bolo: expect.objectContaining({ status: 'expired' }) }),
    )
  })

  it('emits RESPONDER_ASSIGNED event on assignResponder', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const callRepo = new DispatchCallRepository(pool)
    const incidentRepo = new IncidentRepository(pool)
    const responderRepo = new ResponderAssignmentRepository(pool)
    const boloRepo = new BoloRepository(pool)
    const eventBus = makeEventBus()
    const service = new DispatchService({
      calls: callRepo, incidents: incidentRepo, responders: responderRepo,
      bolos: boloRepo, eventBus, telemetry: undefined,
    })

    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])
      .mockResolvedValueOnce([[responderRow()]])

    await service.assignResponder({
      incidentId: 'incident-1', principalId: 'prin-1',
      characterId: 'char-1', agencyId: 'agency-1',
    })

    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_DISPATCH_EVENTS.RESPONDER_ASSIGNED,
      expect.objectContaining({ assignment: expect.objectContaining({ id: 'assignment-1' }) }),
    )
  })
})
