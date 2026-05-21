export { LedgerService } from './ledger.service.js'
export type {
  CommitJournalParams,
  TransferParams,
  JournalEntryInput,
  ListJournalsParams,
} from './ledger.service.js'

export { AccountRepository } from './account.repository.js'
export type {
  CreateAccountParams,
  UpdateAccountStatusParams,
  ListAccountsParams,
} from './account.repository.js'

export {
  LedgerError,
  LedgerImbalanceError,
  LedgerIdempotencyConflictError,
  LedgerInsufficientFundsError,
  LedgerAccountFrozenError,
  LedgerAccountNotFoundError,
  LedgerJournalNotFoundError,
  LedgerReversalError,
  LedgerValidationError,
  LedgerCurrencyMismatchError,
} from './errors.js'

export type { LedgerPool } from './pool.js'

// Re-export PoolConnection so consumers of commitInTransaction can type it without
// depending on mysql2 directly.
export type { PoolConnection } from 'mysql2/promise'
