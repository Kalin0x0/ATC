export class LedgerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LedgerError'
  }
}

export class LedgerImbalanceError extends LedgerError {
  constructor(debitUnits: number, creditUnits: number) {
    super(
      `Journal entries do not balance: debits=${debitUnits} credits=${creditUnits} (units of 1/10000)`,
    )
    this.name = 'LedgerImbalanceError'
  }
}

export class LedgerIdempotencyConflictError extends LedgerError {
  constructor(idempotencyKey: string) {
    super(`Journal already committed with idempotency key: ${idempotencyKey}`)
    this.name = 'LedgerIdempotencyConflictError'
  }
}

export class LedgerInsufficientFundsError extends LedgerError {
  constructor(accountId: string, balance: number, needed: number) {
    super(
      `Insufficient funds in account ${accountId}: balance=${balance.toFixed(4)}, needed=${needed.toFixed(4)}`,
    )
    this.name = 'LedgerInsufficientFundsError'
  }
}

export class LedgerAccountFrozenError extends LedgerError {
  constructor(accountId: string, status: string) {
    super(`Account ${accountId} is not active: status=${status}`)
    this.name = 'LedgerAccountFrozenError'
  }
}

export class LedgerAccountNotFoundError extends LedgerError {
  constructor(accountId: string) {
    super(`Financial account not found: ${accountId}`)
    this.name = 'LedgerAccountNotFoundError'
  }
}

export class LedgerJournalNotFoundError extends LedgerError {
  constructor(journalId: string) {
    super(`Financial journal not found: ${journalId}`)
    this.name = 'LedgerJournalNotFoundError'
  }
}

export class LedgerReversalError extends LedgerError {
  constructor(journalId: string, status: string) {
    super(`Cannot reverse journal ${journalId}: current status is '${status}', must be 'committed'`)
    this.name = 'LedgerReversalError'
  }
}

export class LedgerValidationError extends LedgerError {
  constructor(message: string) {
    super(message)
    this.name = 'LedgerValidationError'
  }
}

export class LedgerCurrencyMismatchError extends LedgerError {
  constructor(accountId: string, accountCurrency: string, entryCurrency: string) {
    super(
      `Currency mismatch on account ${accountId}: account currency is '${accountCurrency}', entry currency is '${entryCurrency}'`,
    )
    this.name = 'LedgerCurrencyMismatchError'
  }
}
