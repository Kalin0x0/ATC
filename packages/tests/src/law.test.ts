import { createHash } from 'node:crypto'
import { describe, it, expect, vi } from 'vitest'
import type { PoolConnection } from 'mysql2/promise'
import {
  AgencyRepository,
  WarrantRepository,
  CitationRepository,
  ArrestRepository,
  JailRepository,
  EvidenceRepository,
  LegalCaseRepository,
  LawEnforcementService,
  AgencySlugConflictError,
  AgencyNotFoundError,
  WarrantNotFoundError,
  WarrantImmutableError,
  CitationNotFoundError,
  CitationAlreadyPaidError,
  CitationImmutableError,
  JailAlreadyActiveError,
  JailRecordNotFoundError,
  EvidenceNotFoundError,
  LegalCaseNotFoundError,
  LawValidationError,
} from '@atc/law'
import type { LawPool } from '@atc/law'
import type { LedgerService } from '@atc/ledger'

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

function makePool(conn: PoolConnection): LawPool {
  return { getConnection: vi.fn().mockResolvedValue(conn) }
}

// ── Fixture rows ───────────────────────────────────────────────────────────────

function agencyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'agency-1', slug: 'lcpd', name: 'Los Santos Police', type: 'police',
    status: 'active', organization_id: null, description: null,
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function warrantRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'warrant-1', character_id: 'char-1', issued_by_principal_id: 'prin-1',
    agency_id: 'agency-1', severity: 'misdemeanor', status: 'active',
    reason: 'Speeding', expires_at: null, executed_at: null,
    revoked_at: null, revoke_reason: null,
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function citationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cit-1', character_id: 'char-1', issued_by_principal_id: 'prin-1',
    agency_id: 'agency-1', reason: 'Running red light', amount: '150.0000',
    currency: 'USD', status: 'unpaid', ledger_journal_id: null,
    idempotency_key: 'idem-1', paid_at: null,
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function arrestRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'arrest-1', character_id: 'char-1', arrested_by_principal_id: 'prin-1',
    agency_id: 'agency-1', warrant_id: null, reason: 'Assault',
    severity: 'felony', notes: null, created_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function jailRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'jail-1', character_id: 'char-1', arrest_record_id: 'arrest-1',
    start_at: new Date('2025-01-01'), release_at: null,
    released_by_principal_id: null, status: 'active',
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function evidenceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ev-1', case_id: null, collected_by_principal_id: 'prin-1',
    label: 'Weapon recovered', metadata_json: null,
    content_hash: 'a'.repeat(64),
    chain_of_custody_json: JSON.stringify([{
      principalId: 'prin-1', transferredAt: new Date('2025-01-01').toISOString(), notes: 'Initial collection',
    }]),
    created_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function legalCaseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'case-1', title: 'People v. Doe', status: 'open',
    agency_id: 'agency-1', created_by_principal_id: 'prin-1', notes: null,
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

// ── AgencyRepository ──────────────────────────────────────────────────────────

describe('AgencyRepository', () => {
  it('creates an agency and returns it', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new AgencyRepository(pool)
    const row = agencyRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([undefined])          // INSERT
      .mockResolvedValueOnce([[row]])               // SELECT

    const result = await repo.create({ slug: 'lcpd', name: 'Los Santos Police', type: 'police' })
    expect(result.slug).toBe('lcpd')
    expect(result.type).toBe('police')
  })

  it('throws AgencySlugConflictError on duplicate slug', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new AgencyRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' })

    await expect(
      repo.create({ slug: 'lcpd', name: 'Los Santos Police', type: 'police' }),
    ).rejects.toBeInstanceOf(AgencySlugConflictError)
  })

  it('throws AgencyNotFoundError when deactivating unknown agency', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new AgencyRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ affectedRows: 0 }])  // UPDATE matched 0 rows

    await expect(repo.deactivate('missing-id')).rejects.toBeInstanceOf(AgencyNotFoundError)
  })
})

// ── WarrantRepository ─────────────────────────────────────────────────────────

describe('WarrantRepository', () => {
  it('creates a warrant and returns it', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new WarrantRepository(pool)
    const row = warrantRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([undefined])   // INSERT
      .mockResolvedValueOnce([[row]])        // SELECT (findById)

    const result = await repo.create({
      characterId: 'char-1', issuedByPrincipalId: 'prin-1',
      agencyId: 'agency-1', severity: 'misdemeanor', reason: 'Speeding',
    })
    expect(result.status).toBe('active')
    expect(result.severity).toBe('misdemeanor')
  })

  it('executes an active warrant', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new WarrantRepository(pool)
    const activeRow  = warrantRow({ status: 'active' })
    const executedRow = warrantRow({ status: 'executed', executed_at: new Date() })
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[activeRow]])    // findById (check status)
      .mockResolvedValueOnce([undefined])      // UPDATE
      .mockResolvedValueOnce([[executedRow]])  // findById (return updated)

    const result = await repo.executeWarrant('warrant-1')
    expect(result.status).toBe('executed')
  })

  it('throws WarrantImmutableError when executing non-active warrant', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new WarrantRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[warrantRow({ status: 'revoked' })]])

    await expect(repo.executeWarrant('warrant-1')).rejects.toBeInstanceOf(WarrantImmutableError)
  })

  it('revokes an active warrant with a reason', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new WarrantRepository(pool)
    const revokedRow = warrantRow({ status: 'revoked', revoke_reason: 'Filed in error' })
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[warrantRow({ status: 'active' })]])
      .mockResolvedValueOnce([undefined])
      .mockResolvedValueOnce([[revokedRow]])

    const result = await repo.revokeWarrant('warrant-1', 'Filed in error')
    expect(result.status).toBe('revoked')
    expect(result.revokeReason).toBe('Filed in error')
  })
})

// ── CitationRepository ────────────────────────────────────────────────────────

describe('CitationRepository', () => {
  it('creates a citation and returns it', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new CitationRepository(pool)
    const row = citationRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([undefined])   // INSERT
      .mockResolvedValueOnce([[row]])        // SELECT

    const result = await repo.create({
      characterId: 'char-1', issuedByPrincipalId: 'prin-1',
      agencyId: 'agency-1', reason: 'Running red light',
      amount: 150, currency: 'USD', idempotencyKey: 'idem-1',
    })
    expect(result.amount).toBe(150)
    expect(result.status).toBe('unpaid')
  })

  it('replays idempotent citation on ER_DUP_ENTRY', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new CitationRepository(pool)
    const row = citationRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' })   // INSERT fails
      .mockResolvedValueOnce([[row]])                       // findByIdempotencyKey SELECT

    const result = await repo.create({
      characterId: 'char-1', issuedByPrincipalId: 'prin-1',
      agencyId: 'agency-1', reason: 'Running red light',
      amount: 150, currency: 'USD', idempotencyKey: 'idem-1',
    })
    expect(result.id).toBe('cit-1')
  })

  it('marks citation as paid', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new CitationRepository(pool)
    const unpaidRow = citationRow({ status: 'unpaid' })
    const paidRow   = citationRow({ status: 'paid', ledger_journal_id: 'jrn-1', paid_at: new Date() })
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[unpaidRow]])   // findById — check status
      .mockResolvedValueOnce([undefined])     // UPDATE
      .mockResolvedValueOnce([[paidRow]])     // findById — return updated

    const result = await repo.markPaid('cit-1', 'jrn-1', new Date())
    expect(result.status).toBe('paid')
    expect(result.ledgerJournalId).toBe('jrn-1')
  })

  it('throws CitationAlreadyPaidError when marking already-paid citation', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new CitationRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[citationRow({ status: 'paid' })]])

    await expect(repo.markPaid('cit-1', 'jrn-2', new Date()))
      .rejects.toBeInstanceOf(CitationAlreadyPaidError)
  })
})

// ── JailRepository ────────────────────────────────────────────────────────────

describe('JailRepository', () => {
  it('enters jail and returns record', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new JailRepository(pool)
    const row = jailRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[]])           // FOR UPDATE — no active record
      .mockResolvedValueOnce([undefined])    // INSERT
      .mockResolvedValueOnce([[row]])        // SELECT after commit

    const result = await repo.enter({ characterId: 'char-1', arrestRecordId: 'arrest-1' })
    expect(result.status).toBe('active')
    expect(result.characterId).toBe('char-1')
  })

  it('throws JailAlreadyActiveError when active record exists', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new JailRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[jailRow({ status: 'active' })]])  // FOR UPDATE finds existing

    await expect(
      repo.enter({ characterId: 'char-1', arrestRecordId: 'arrest-1' }),
    ).rejects.toBeInstanceOf(JailAlreadyActiveError)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('releases jail record and returns updated record', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new JailRepository(pool)
    const releasedRow = jailRow({ status: 'released', released_by_principal_id: 'prin-2', release_at: new Date() })
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ affectedRows: 1 }])   // UPDATE
      .mockResolvedValueOnce([[releasedRow]])           // SELECT

    const result = await repo.release('jail-1', 'prin-2')
    expect(result.status).toBe('released')
    expect(result.releasedByPrincipalId).toBe('prin-2')
  })

  it('finds active jail record for character', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new JailRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[jailRow()]])

    const result = await repo.findActiveForCharacter('char-1')
    expect(result).not.toBeNull()
    expect(result?.status).toBe('active')
  })

  it('returns null when character has no active jail record', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new JailRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[]])

    const result = await repo.findActiveForCharacter('char-nobody')
    expect(result).toBeNull()
  })
})

// ── EvidenceRepository ────────────────────────────────────────────────────────

describe('EvidenceRepository', () => {
  it('computes correct SHA-256 content hash', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new EvidenceRepository(pool)
    const content = 'fingerprint data'
    const expectedHash = createHash('sha256').update(content).digest('hex')

    let capturedHash = ''
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async (_sql: string, args: unknown[]) => {
        // args: [id, case_id, collected_by, label, metadata, content_hash, chain_json, ...]
        capturedHash = args[5] as string
        return [undefined]
      })
      .mockResolvedValueOnce([[evidenceRow({ content_hash: expectedHash })]])

    await repo.collect({
      collectedByPrincipalId: 'prin-1',
      label: 'Fingerprint',
      content,
    })

    expect(capturedHash).toBe(expectedHash)
  })

  it('appends new entry to chain of custody on transfer', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new EvidenceRepository(pool)

    const initialCustody = [{ principalId: 'prin-1', transferredAt: new Date().toISOString(), notes: 'Initial collection' }]
    const row = evidenceRow({ chain_of_custody_json: JSON.stringify(initialCustody) })
    const updatedRow = evidenceRow({
      chain_of_custody_json: JSON.stringify([
        ...initialCustody,
        { principalId: 'prin-2', transferredAt: new Date().toISOString(), notes: 'Transfer to forensics' },
      ]),
    })

    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[row]])          // SELECT current record
      .mockResolvedValueOnce([undefined])      // UPDATE chain_of_custody_json
      .mockResolvedValueOnce([[updatedRow]])   // SELECT after update

    const result = await repo.transferCustody('ev-1', 'prin-2', 'Transfer to forensics')
    expect(result.chainOfCustody).toHaveLength(2)
    expect(result.chainOfCustody[1].principalId).toBe('prin-2')
  })

  it('throws EvidenceNotFoundError when transferring custody of unknown evidence', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new EvidenceRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[]])   // SELECT returns empty

    await expect(
      repo.transferCustody('unknown-id', 'prin-2', null),
    ).rejects.toBeInstanceOf(EvidenceNotFoundError)
  })
})

// ── LegalCaseRepository ───────────────────────────────────────────────────────

describe('LegalCaseRepository', () => {
  it('creates a case with status open', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new LegalCaseRepository(pool)
    const row = legalCaseRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([undefined])    // INSERT
      .mockResolvedValueOnce([[row]])         // SELECT

    const result = await repo.create({
      title: 'People v. Doe', agencyId: 'agency-1', createdByPrincipalId: 'prin-1',
    })
    expect(result.status).toBe('open')
    expect(result.title).toBe('People v. Doe')
  })

  it('closes an open case', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new LegalCaseRepository(pool)
    const closedRow = legalCaseRow({ status: 'closed' })
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[legalCaseRow()]])   // FOR UPDATE SELECT
      .mockResolvedValueOnce([undefined])           // UPDATE
      .mockResolvedValueOnce([[closedRow]])         // _findById SELECT after commit

    const result = await repo.close('case-1')
    expect(result.status).toBe('closed')
  })

  it('throws LawValidationError when closing an already-closed case', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new LegalCaseRepository(pool)
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[legalCaseRow({ status: 'closed' })]])

    await expect(repo.close('case-1')).rejects.toBeInstanceOf(LawValidationError)
  })
})

// ── ArrestRepository ──────────────────────────────────────────────────────────

describe('ArrestRepository', () => {
  it('creates an append-only arrest record', async () => {
    const conn = makeConn()
    const pool = makePool(conn)
    const repo = new ArrestRepository(pool)
    const row = arrestRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([undefined])   // INSERT
      .mockResolvedValueOnce([[row]])        // SELECT

    const result = await repo.create({
      characterId: 'char-1', arrestedByPrincipalId: 'prin-1',
      agencyId: 'agency-1', reason: 'Assault', severity: 'felony',
    })
    expect(result.severity).toBe('felony')
    expect(result.characterId).toBe('char-1')
  })
})

// ── LawEnforcementService ─────────────────────────────────────────────────────

describe('LawEnforcementService', () => {
  function makeRepos() {
    const conn = makeConn()
    const pool = makePool(conn)
    const agencies  = new AgencyRepository(pool)
    const warrants  = new WarrantRepository(pool)
    const citations = new CitationRepository(pool)
    const arrests   = new ArrestRepository(pool)
    const jail      = new JailRepository(pool)
    const evidence  = new EvidenceRepository(pool)
    const cases     = new LegalCaseRepository(pool)
    return { conn, agencies, warrants, citations, arrests, jail, evidence, cases }
  }

  it('emits CITATION_PAID event and calls ledger.transfer on payCitation', async () => {
    const { conn, citations, ...rest } = makeRepos()
    const eventBus = { emit: vi.fn() }
    const ledger: Partial<LedgerService> = {
      transfer: vi.fn().mockResolvedValue({ id: 'jrn-99', committedAt: new Date() }),
    }

    const svc = new LawEnforcementService({
      ...rest,
      citations,
      ledger:   ledger as LedgerService,
      eventBus: eventBus as unknown as import('@atc/events').AtcEventBus,
    })

    const unpaidRow = citationRow({ status: 'unpaid' })
    const paidRow   = citationRow({ status: 'paid', ledger_journal_id: 'jrn-99', paid_at: new Date() })

    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[unpaidRow]])  // findById — status check
      .mockResolvedValueOnce([[unpaidRow]])  // markPaid: findById
      .mockResolvedValueOnce([undefined])    // markPaid: UPDATE
      .mockResolvedValueOnce([[paidRow]])    // markPaid: findById (return)

    const result = await svc.payCitation({
      citationId:    'cit-1',
      fromAccountId: 'acct-char',
      toAccountId:   'acct-agency',
    })

    expect(ledger.transfer).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'citation:pay:cit-1',
        referenceType:  'citation',
        referenceId:    'cit-1',
      }),
    )
    expect(result.status).toBe('paid')
    expect(eventBus.emit).toHaveBeenCalledWith(
      'atc:law:citation:paid',
      expect.objectContaining({ journalId: 'jrn-99' }),
    )
  })

  it('throws CitationAlreadyPaidError without calling ledger when citation already paid', async () => {
    const { conn, citations, ...rest } = makeRepos()
    const ledger: Partial<LedgerService> = {
      transfer: vi.fn(),
    }

    const svc = new LawEnforcementService({
      ...rest,
      citations,
      ledger: ledger as LedgerService,
    })

    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([[citationRow({ status: 'paid' })]])

    await expect(
      svc.payCitation({ citationId: 'cit-1', fromAccountId: 'a', toAccountId: 'b' }),
    ).rejects.toBeInstanceOf(CitationAlreadyPaidError)

    expect(ledger.transfer).not.toHaveBeenCalled()
  })

  it('emits WARRANT_CREATED event on issueWarrant', async () => {
    const { conn, warrants, ...rest } = makeRepos()
    const eventBus = { emit: vi.fn() }

    const svc = new LawEnforcementService({
      ...rest,
      warrants,
      eventBus: eventBus as unknown as import('@atc/events').AtcEventBus,
    })

    const row = warrantRow()
    ;(conn.execute as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([undefined])   // INSERT
      .mockResolvedValueOnce([[row]])        // SELECT

    await svc.issueWarrant({
      characterId: 'char-1', issuedByPrincipalId: 'prin-1',
      agencyId: 'agency-1', severity: 'misdemeanor', reason: 'Speeding',
    })

    expect(eventBus.emit).toHaveBeenCalledWith('atc:law:warrant:created', expect.any(Object))
  })
})
