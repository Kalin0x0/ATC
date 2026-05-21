export class MarketError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarketError'
  }
}

export class BankAccountNotFoundError extends MarketError {
  constructor(public readonly principalId: string) {
    super(`Bank account not found for principal: ${principalId}`)
    this.name = 'BankAccountNotFoundError'
  }
}

export class BankAccountFrozenError extends MarketError {
  constructor(public readonly principalId: string) {
    super(`Bank account is frozen for principal: ${principalId}`)
    this.name = 'BankAccountFrozenError'
  }
}

export class InsufficientFundsError extends MarketError {
  constructor(
    public readonly principalId: string,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(
      `Insufficient funds for principal ${principalId}: required ${required}, available ${available}`,
    )
    this.name = 'InsufficientFundsError'
  }
}

export class NegativeBalanceError extends MarketError {
  constructor(public readonly principalId: string) {
    super(`Operation would result in negative balance for principal: ${principalId}`)
    this.name = 'NegativeBalanceError'
  }
}

export class DuplicateTransactionError extends MarketError {
  constructor(public readonly idempotencyKey: string) {
    super(`Duplicate transaction for idempotency key: ${idempotencyKey}`)
    this.name = 'DuplicateTransactionError'
  }
}

export class TransactionNotFoundError extends MarketError {
  constructor(public readonly id: string) {
    super(`Transaction not found: ${id}`)
    this.name = 'TransactionNotFoundError'
  }
}

export class ListingNotFoundError extends MarketError {
  constructor(public readonly id: string) {
    super(`Listing not found: ${id}`)
    this.name = 'ListingNotFoundError'
  }
}

export class ListingExpiredError extends MarketError {
  constructor(public readonly id: string) {
    super(`Listing has expired: ${id}`)
    this.name = 'ListingExpiredError'
  }
}

export class ListingAlreadySoldError extends MarketError {
  constructor(public readonly id: string) {
    super(`Listing has already been sold: ${id}`)
    this.name = 'ListingAlreadySoldError'
  }
}

export class AuctionNotFoundError extends MarketError {
  constructor(public readonly id: string) {
    super(`Auction not found: ${id}`)
    this.name = 'AuctionNotFoundError'
  }
}

export class AuctionEndedError extends MarketError {
  constructor(public readonly id: string) {
    super(`Auction has ended: ${id}`)
    this.name = 'AuctionEndedError'
  }
}

export class AuctionBidTooLowError extends MarketError {
  constructor(
    public readonly auctionId: string,
    public readonly minimumBid: number,
    public readonly bidAmount: number,
  ) {
    super(
      `Bid too low for auction ${auctionId}: minimum ${minimumBid}, got ${bidAmount}`,
    )
    this.name = 'AuctionBidTooLowError'
  }
}

export class TaxRecordNotFoundError extends MarketError {
  constructor(public readonly id: string) {
    super(`Tax record not found: ${id}`)
    this.name = 'TaxRecordNotFoundError'
  }
}

export class FinancialFlagNotFoundError extends MarketError {
  constructor(public readonly id: string) {
    super(`Financial flag not found: ${id}`)
    this.name = 'FinancialFlagNotFoundError'
  }
}
