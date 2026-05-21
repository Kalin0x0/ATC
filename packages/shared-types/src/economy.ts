// ── Financial Accounts ────────────────────────────────────────────────────────

export type FinancialAccountType = 'cash' | 'bank' | 'treasury' | 'escrow' | 'system'
export type FinancialAccountStatus = 'active' | 'frozen' | 'closed'
export type FinancialAccountOwnerType = 'character' | 'organization' | 'system'

export interface FinancialAccount {
  readonly id: string
  readonly ownerType: FinancialAccountOwnerType
  readonly ownerId: string
  readonly accountType: FinancialAccountType
  readonly currency: string
  readonly balance: number
  readonly balanceVersion: number
  readonly status: FinancialAccountStatus
  readonly metadata: Readonly<Record<string, string>> | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface FinancialAccountPage {
  items: FinancialAccount[]
  total: number
  offset: number
  limit: number
}

// ── Double-Entry Journals ─────────────────────────────────────────────────────

export type JournalStatus = 'pending' | 'committed' | 'reversed'
export type JournalEntryType = 'debit' | 'credit'
export type JournalSource = 'system' | 'admin' | 'api' | 'gameplay'

export interface FinancialJournal {
  readonly id: string
  readonly idempotencyKey: string
  readonly description: string
  readonly source: JournalSource
  readonly status: JournalStatus
  readonly referenceId: string | null
  readonly referenceType: string | null
  readonly committedAt: Date | null
  readonly reversedAt: Date | null
  readonly reversalOfId: string | null
  readonly createdAt: Date
}

export interface FinancialEntry {
  readonly id: string
  readonly journalId: string
  readonly accountId: string
  readonly entryType: JournalEntryType
  readonly amount: number
  readonly currency: string
  readonly createdAt: Date
}

export interface FinancialJournalWithEntries extends FinancialJournal {
  readonly entries: ReadonlyArray<FinancialEntry>
}

export interface FinancialJournalPage {
  items: FinancialJournalWithEntries[]
  total: number
  offset: number
  limit: number
}

// ── Organizations ─────────────────────────────────────────────────────────────

export type OrganizationType = 'business' | 'faction' | 'government' | 'charity'
export type OrganizationStatus = 'active' | 'suspended' | 'dissolved'
export type OrganizationMemberRole = 'owner' | 'director' | 'accountant' | 'employee' | 'auditor'

export interface Organization {
  readonly id: string
  readonly name: string
  readonly displayName: string
  readonly type: OrganizationType
  readonly status: OrganizationStatus
  readonly treasuryAccountId: string | null
  readonly ownerId: string
  readonly metadata: Readonly<Record<string, string>> | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface OrganizationMember {
  readonly id: string
  readonly organizationId: string
  readonly characterId: string
  readonly role: OrganizationMemberRole
  readonly joinedAt: Date
  readonly expiresAt: Date | null
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled' | 'overdue'
export type InvoicePartyType = 'character' | 'organization'

export interface Invoice {
  readonly id: string
  readonly issuerId: string
  readonly issuerType: InvoicePartyType
  readonly recipientId: string
  readonly recipientType: InvoicePartyType
  readonly amount: number
  readonly currency: string
  readonly description: string
  readonly status: InvoiceStatus
  readonly dueAt: Date | null
  readonly paidAt: Date | null
  readonly cancelledAt: Date | null
  readonly paymentJournalId: string | null
  readonly metadata: Readonly<Record<string, unknown>> | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface InvoicePayment {
  readonly id: string
  readonly invoiceId: string
  readonly amount: number
  readonly currency: string
  readonly journalId: string
  readonly paidAt: Date
}

export interface InvoicePage {
  items: Invoice[]
  total: number
  offset: number
  limit: number
}
