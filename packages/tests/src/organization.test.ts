import { describe, it, expect, vi } from 'vitest'
import type { PoolConnection } from 'mysql2/promise'
import { OrganizationRepository, MemberRepository, InvoiceRepository } from '@atc/organization'
import type { OrganizationPool } from '@atc/organization'

// ── Mock pool helpers ──────────────────────────────────────────────────────────

function makeConn(executeImpl: (sql: string, values?: unknown[]) => Promise<unknown[][]>): PoolConnection {
  return {
    execute: vi.fn(executeImpl) as PoolConnection['execute'],
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  } as unknown as PoolConnection
}

function makePool(conn: PoolConnection): OrganizationPool {
  return { getConnection: vi.fn().mockResolvedValue(conn) }
}

const baseOrgRow = {
  id: 'org-1',
  name: 'acme_corp',
  display_name: 'ACME Corporation',
  type: 'business',
  status: 'active',
  treasury_account_id: null,
  owner_id: 'char-owner',
  metadata: null,
  created_at: new Date(),
  updated_at: new Date(),
}

// ── OrganizationRepository ────────────────────────────────────────────────────

describe('OrganizationRepository.create', () => {
  it('creates an organization and returns it', async () => {
    const conn = makeConn(async (sql) => {
      if (sql.includes('INSERT')) return [{ insertId: 'org-1' }]
      if (sql.includes('SELECT')) return [[baseOrgRow]]
      return [[]]
    })
    const repo = new OrganizationRepository(makePool(conn))

    const org = await repo.create({
      name: 'acme_corp',
      displayName: 'ACME Corporation',
      type: 'business',
      ownerId: 'char-owner',
    })

    expect(org.id).toBe('org-1')
    expect(org.name).toBe('acme_corp')
    expect(org.type).toBe('business')
    expect(org.status).toBe('active')
    expect(org.treasuryAccountId).toBeNull()
  })
})

describe('OrganizationRepository.findById', () => {
  it('returns null for unknown organization', async () => {
    const conn = makeConn(async () => [[]])
    const repo = new OrganizationRepository(makePool(conn))
    const result = await repo.findById('unknown')
    expect(result).toBeNull()
  })

  it('returns organization for known id', async () => {
    const conn = makeConn(async () => [[baseOrgRow]])
    const repo = new OrganizationRepository(makePool(conn))
    const result = await repo.findById('org-1')
    expect(result?.id).toBe('org-1')
    expect(result?.displayName).toBe('ACME Corporation')
  })
})

describe('OrganizationRepository.update', () => {
  it('updates display name', async () => {
    const updatedRow = { ...baseOrgRow, display_name: 'ACME Inc' }
    const conn = makeConn(async (sql) => {
      if (sql.includes('UPDATE')) return [{ affectedRows: 1 }]
      if (sql.includes('SELECT')) return [[updatedRow]]
      return [[]]
    })
    const repo = new OrganizationRepository(makePool(conn))
    const result = await repo.update('org-1', { displayName: 'ACME Inc' })
    expect(result?.displayName).toBe('ACME Inc')
  })

  it('returns null when organization not found', async () => {
    const conn = makeConn(async (sql) => {
      if (sql.includes('UPDATE')) return [{ affectedRows: 0 }]
      return [[]]
    })
    const repo = new OrganizationRepository(makePool(conn))
    const result = await repo.update('nonexistent', { displayName: 'X' })
    expect(result).toBeNull()
  })

  it('no-op returns existing org when no fields provided', async () => {
    const conn = makeConn(async () => [[baseOrgRow]])
    const repo = new OrganizationRepository(makePool(conn))
    const result = await repo.update('org-1', {})
    expect(result?.id).toBe('org-1')
  })
})

// ── MemberRepository ──────────────────────────────────────────────────────────

const baseMemberRow = {
  id: 'mem-1',
  organization_id: 'org-1',
  character_id: 'char-1',
  role: 'employee',
  joined_at: new Date(),
  expires_at: null,
}

describe('MemberRepository.add', () => {
  it('adds a member and returns them', async () => {
    const conn = makeConn(async (sql) => {
      if (sql.includes('INSERT')) return [{ insertId: 'mem-1' }]
      if (sql.includes('SELECT')) return [[baseMemberRow]]
      return [[]]
    })
    const repo = new MemberRepository(makePool(conn))

    const member = await repo.add({
      organizationId: 'org-1',
      characterId: 'char-1',
      role: 'employee',
    })

    expect(member.id).toBe('mem-1')
    expect(member.role).toBe('employee')
    expect(member.expiresAt).toBeNull()
  })
})

describe('MemberRepository.remove', () => {
  it('returns true when member removed', async () => {
    const conn = makeConn(async () => [{ affectedRows: 1 }])
    const repo = new MemberRepository(makePool(conn))
    const result = await repo.remove('org-1', 'char-1')
    expect(result).toBe(true)
  })

  it('returns false when member not found', async () => {
    const conn = makeConn(async () => [{ affectedRows: 0 }])
    const repo = new MemberRepository(makePool(conn))
    const result = await repo.remove('org-1', 'nonexistent')
    expect(result).toBe(false)
  })
})

describe('MemberRepository.listByOrganization', () => {
  it('returns active (non-expired) members', async () => {
    const conn = makeConn(async () => [[baseMemberRow, { ...baseMemberRow, id: 'mem-2', character_id: 'char-2', role: 'director' }]])
    const repo = new MemberRepository(makePool(conn))
    const members = await repo.listByOrganization('org-1')
    expect(members).toHaveLength(2)
    expect(members[0]?.role).toBe('employee')
    expect(members[1]?.role).toBe('director')
  })
})

// ── InvoiceRepository ─────────────────────────────────────────────────────────

const baseInvoiceRow = {
  id: 'inv-1',
  issuer_id: 'org-1',
  issuer_type: 'organization',
  recipient_id: 'char-1',
  recipient_type: 'character',
  amount: '500.0000',
  currency: 'USD',
  description: 'Service fee',
  status: 'issued',
  due_at: null,
  paid_at: null,
  cancelled_at: null,
  payment_journal_id: null,
  metadata: null,
  created_at: new Date(),
  updated_at: new Date(),
}

describe('InvoiceRepository.create', () => {
  it('creates an issued invoice', async () => {
    const conn = makeConn(async (sql) => {
      if (sql.includes('INSERT')) return [{ insertId: 'inv-1' }]
      if (sql.includes('SELECT')) return [[baseInvoiceRow]]
      return [[]]
    })
    const repo = new InvoiceRepository(makePool(conn))

    const invoice = await repo.create({
      issuerId: 'org-1',
      issuerType: 'organization',
      recipientId: 'char-1',
      recipientType: 'character',
      amount: 500,
      currency: 'USD',
      description: 'Service fee',
    })

    expect(invoice.id).toBe('inv-1')
    expect(invoice.amount).toBe(500)
    expect(invoice.status).toBe('issued')
  })
})

describe('InvoiceRepository.findById', () => {
  it('returns null for unknown invoice', async () => {
    const conn = makeConn(async () => [[]])
    const repo = new InvoiceRepository(makePool(conn))
    const result = await repo.findById('unknown')
    expect(result).toBeNull()
  })

  it('returns invoice for known id', async () => {
    const conn = makeConn(async () => [[baseInvoiceRow]])
    const repo = new InvoiceRepository(makePool(conn))
    const result = await repo.findById('inv-1')
    expect(result?.id).toBe('inv-1')
    expect(result?.amount).toBe(500)
  })
})

describe('InvoiceRepository.markPaid', () => {
  it('marks invoice as paid and records payment', async () => {
    const paidRow = { ...baseInvoiceRow, status: 'paid', paid_at: new Date(), payment_journal_id: 'jrn-1' }
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (sql.includes('FOR UPDATE')) return [[baseInvoiceRow]]
      if (sql.includes('atc_invoice_payments') && sql.includes('INSERT')) return [{ insertId: 'pay-1' }]
      if (sql.includes('UPDATE atc_invoices')) return [{ affectedRows: 1 }]
      if (sql.includes('SELECT') && sql.includes('atc_invoices')) return [[paidRow]]
      return [[]]
    })
    const repo = new InvoiceRepository(makePool(conn))
    const result = await repo.markPaid('inv-1', 'jrn-1')
    expect(result?.status).toBe('paid')
    expect(result?.paymentJournalId).toBe('jrn-1')
  })

  it('returns null when invoice not in issued status', async () => {
    const conn = makeConn(async (sql) => {
      if (sql.includes('FOR UPDATE')) return [[]] // not found (already paid)
      return [[]]
    })
    const repo = new InvoiceRepository(makePool(conn))
    const result = await repo.markPaid('inv-paid', 'jrn-1')
    expect(result).toBeNull()
  })
})

describe('InvoiceRepository.cancel', () => {
  it('cancels an invoice', async () => {
    const cancelledRow = { ...baseInvoiceRow, status: 'cancelled', cancelled_at: new Date() }
    const conn = makeConn(async (sql) => {
      if (sql.includes('UPDATE')) return [{ affectedRows: 1 }]
      if (sql.includes('SELECT')) return [[cancelledRow]]
      return [[]]
    })
    const repo = new InvoiceRepository(makePool(conn))
    const result = await repo.cancel('inv-1')
    expect(result?.status).toBe('cancelled')
  })
})
