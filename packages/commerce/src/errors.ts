export class CommerceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommerceError'
  }
}

export class CommerceValidationError extends CommerceError {
  constructor(message: string) {
    super(message)
    this.name = 'CommerceValidationError'
  }
}

export class CommerceShopNotFoundError extends CommerceError {
  constructor(shopId: string) {
    super(`Shop not found: ${shopId}`)
    this.name = 'CommerceShopNotFoundError'
  }
}

export class CommerceShopNotActiveError extends CommerceError {
  constructor(shopId: string, status: string) {
    super(`Shop ${shopId} is not active: status=${status}`)
    this.name = 'CommerceShopNotActiveError'
  }
}

export class CommerceShopItemNotFoundError extends CommerceError {
  constructor(shopId: string, itemId: string) {
    super(`Item '${itemId}' not found in shop ${shopId}`)
    this.name = 'CommerceShopItemNotFoundError'
  }
}

export class CommerceInsufficientStockError extends CommerceError {
  readonly shopId: string
  readonly itemId: string
  readonly available: number
  readonly requested: number
  constructor(shopId: string, itemId: string, available: number, requested: number) {
    super(`Insufficient stock for item '${itemId}' in shop ${shopId}: available=${available}, requested=${requested}`)
    this.name = 'CommerceInsufficientStockError'
    this.shopId = shopId
    this.itemId = itemId
    this.available = available
    this.requested = requested
  }
}

export class CommerceShopCannotBuyError extends CommerceError {
  constructor(shopId: string, itemId: string) {
    super(`Shop ${shopId} does not buy item '${itemId}' (no sell_price configured)`)
    this.name = 'CommerceShopCannotBuyError'
  }
}

export class CommerceCurrencyMismatchError extends CommerceError {
  constructor(expected: string, got: string) {
    super(`Currency mismatch: shop currency is '${expected}', request currency is '${got}'`)
    this.name = 'CommerceCurrencyMismatchError'
  }
}

export class CommerceInsufficientInventoryError extends CommerceError {
  constructor(characterId: string, itemId: string, owned: number, requested: number) {
    super(`Character ${characterId} has insufficient '${itemId}': owned=${owned}, requested=${requested}`)
    this.name = 'CommerceInsufficientInventoryError'
  }
}

export class CommerceInventoryFullError extends CommerceError {
  constructor(characterId: string) {
    super(`Inventory full for character ${characterId}: no free slots available`)
    this.name = 'CommerceInventoryFullError'
  }
}

export class CommerceOrderNotFoundError extends CommerceError {
  constructor(orderId: string) {
    super(`Commerce order not found: ${orderId}`)
    this.name = 'CommerceOrderNotFoundError'
  }
}

export class CommerceReceiptNotFoundError extends CommerceError {
  constructor(receiptId: string) {
    super(`Commerce receipt not found: ${receiptId}`)
    this.name = 'CommerceReceiptNotFoundError'
  }
}

export class CommerceShopMisconfiguredError extends CommerceError {
  constructor(shopId: string, reason: string) {
    super(`Shop ${shopId} is misconfigured: ${reason}`)
    this.name = 'CommerceShopMisconfiguredError'
  }
}

export class CommerceIdempotencyReplayError extends CommerceError {
  constructor(idempotencyKey: string) {
    super(`Request already processed with idempotency key: ${idempotencyKey}`)
    this.name = 'CommerceIdempotencyReplayError'
  }
}
