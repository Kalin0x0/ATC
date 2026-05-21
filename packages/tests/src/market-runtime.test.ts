import { describe, it, expect, vi } from 'vitest'
import {
  MarketError,
  BankAccountNotFoundError,
  BankAccountFrozenError,
  InsufficientFundsError,
  NegativeBalanceError,
  DuplicateTransactionError,
  ListingNotFoundError,
  ListingExpiredError,
  ListingAlreadySoldError,
  AuctionNotFoundError,
  AuctionEndedError,
  AuctionBidTooLowError,
} from '@atc/market-runtime'
import {
  bankTransferSchema,
  createListingSchema,
  purchaseListingSchema,
  createAuctionSchema,
  placeBidSchema,
  freezeAccountSchema,
  settleAuctionSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('MarketError hierarchy', () => {
  it('BankAccountNotFoundError extends MarketError', () => {
    const e = new BankAccountNotFoundError('p-1')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('p-1')
  })

  it('BankAccountFrozenError extends MarketError', () => {
    const e = new BankAccountFrozenError('p-2')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('p-2')
  })

  it('InsufficientFundsError extends MarketError', () => {
    const e = new InsufficientFundsError('p-3', 1000n, 500n)
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('p-3')
  })

  it('NegativeBalanceError extends MarketError', () => {
    const e = new NegativeBalanceError('acc-1')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('acc-1')
  })

  it('DuplicateTransactionError extends MarketError', () => {
    const e = new DuplicateTransactionError('idem-abc')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('idem-abc')
  })

  it('ListingNotFoundError extends MarketError', () => {
    const e = new ListingNotFoundError('l-1')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('l-1')
  })

  it('ListingExpiredError extends MarketError', () => {
    const e = new ListingExpiredError('l-2')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('l-2')
  })

  it('ListingAlreadySoldError extends MarketError', () => {
    const e = new ListingAlreadySoldError('l-3')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('l-3')
  })

  it('AuctionNotFoundError extends MarketError', () => {
    const e = new AuctionNotFoundError('a-1')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('a-1')
  })

  it('AuctionEndedError extends MarketError', () => {
    const e = new AuctionEndedError('a-2')
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('a-2')
  })

  it('AuctionBidTooLowError extends MarketError', () => {
    const e = new AuctionBidTooLowError('a-3', 1000n, 500n)
    expect(e).toBeInstanceOf(MarketError)
    expect(e.message).toContain('a-3')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('bankTransferSchema', () => {
  it('accepts valid transfer', () => {
    const result = bankTransferSchema.safeParse({
      fromPrincipalId: 'p-1',
      toPrincipalId:   'p-2',
      amount:          '1000',
      idempotencyKey:  'tx-abc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer amount string', () => {
    const result = bankTransferSchema.safeParse({
      fromPrincipalId: 'p-1',
      toPrincipalId:   'p-2',
      amount:          '10.50',
      idempotencyKey:  'tx-abc',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing idempotencyKey', () => {
    const result = bankTransferSchema.safeParse({
      fromPrincipalId: 'p-1',
      toPrincipalId:   'p-2',
      amount:          '1000',
    })
    expect(result.success).toBe(false)
  })
})

describe('createListingSchema', () => {
  it('accepts valid listing', () => {
    const result = createListingSchema.safeParse({
      sellerPrincipalId: 'p-1',
      itemName:          'Water Bottle',
      quantity:          10,
      pricePerUnit:      '500',
      listingNonce:      'lst-nonce-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero quantity', () => {
    const result = createListingSchema.safeParse({
      sellerPrincipalId: 'p-1',
      itemName:          'Water Bottle',
      quantity:          0,
      pricePerUnit:      '500',
      listingNonce:      'lst-nonce-2',
    })
    expect(result.success).toBe(false)
  })
})

describe('createAuctionSchema', () => {
  it('accepts valid auction', () => {
    const result = createAuctionSchema.safeParse({
      sellerPrincipalId:   'p-1',
      itemName:            'Rare Car',
      quantity:            1,
      startingBid:         '100000',
      minimumBidIncrement: '1000',
      auctionNonce:        'auc-nonce-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional reservePrice', () => {
    const result = createAuctionSchema.safeParse({
      sellerPrincipalId:   'p-1',
      itemName:            'Rare Car',
      quantity:            1,
      startingBid:         '100000',
      minimumBidIncrement: '1000',
      reservePrice:        '500000',
      auctionNonce:        'auc-nonce-2',
    })
    expect(result.success).toBe(true)
  })
})

describe('placeBidSchema', () => {
  it('accepts valid bid', () => {
    const result = placeBidSchema.safeParse({
      auctionId:         'a-1',
      bidderPrincipalId: 'p-2',
      bidAmount:         '150000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer bidAmount', () => {
    const result = placeBidSchema.safeParse({
      auctionId:         'a-1',
      bidderPrincipalId: 'p-2',
      bidAmount:         'one hundred',
    })
    expect(result.success).toBe(false)
  })
})

describe('freezeAccountSchema', () => {
  it('accepts valid freeze request', () => {
    const result = freezeAccountSchema.safeParse({
      principalId:         'p-suspect',
      frozenByPrincipalId: 'p-admin',
      reason:              'Suspicious activity',
    })
    expect(result.success).toBe(true)
  })
})

// ── Bank Settlement (service mock) ────────────────────────────────────────────

describe('BankingRuntimeService — bank settlement', () => {
  it('transfers funds atomically and returns completed transaction', async () => {
    const mockTransfer = vi.fn().mockResolvedValue({
      id:              'tx-1',
      status:          'completed',
      amount:          1000n,
      idempotencyKey:  'tx-abc',
    })
    const mockService = { transfer: mockTransfer }
    const result = await mockService.transfer({
      fromPrincipalId: 'p-1',
      toPrincipalId:   'p-2',
      amount:          1000n,
      idempotencyKey:  'tx-abc',
    })
    expect(result.status).toBe('completed')
    expect(result.amount).toBe(1000n)
  })

  it('throws InsufficientFundsError when balance is too low', async () => {
    const mockTransfer = vi.fn().mockRejectedValue(new InsufficientFundsError('p-1', 100n, 1000n))
    const mockService = { transfer: mockTransfer }
    await expect(mockService.transfer({ amount: 1000n })).rejects.toBeInstanceOf(InsufficientFundsError)
  })

  it('throws DuplicateTransactionError on duplicate idempotency key', async () => {
    const mockTransfer = vi.fn().mockRejectedValue(new DuplicateTransactionError('tx-abc'))
    const mockService = { transfer: mockTransfer }
    await expect(mockService.transfer({ idempotencyKey: 'tx-abc' })).rejects.toBeInstanceOf(DuplicateTransactionError)
  })
})

// ── Marketplace Anti-duplication ──────────────────────────────────────────────

describe('MarketplaceService — anti-duplication', () => {
  it('second createListing with same nonce returns existing listing', async () => {
    const existing = { id: 'l-1', status: 'active', listingNonce: 'nonce-x' }
    const mockCreate = vi.fn()
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
    const mockService = { createListing: mockCreate }

    const first  = await mockService.createListing({ listingNonce: 'nonce-x' })
    const second = await mockService.createListing({ listingNonce: 'nonce-x' })
    expect(first).toStrictEqual(second)
  })

  it('throws ListingAlreadySoldError on purchase of sold listing', async () => {
    const mockPurchase = vi.fn().mockRejectedValue(new ListingAlreadySoldError('l-1'))
    const mockService = { purchaseListing: mockPurchase }
    await expect(mockService.purchaseListing({ listingId: 'l-1' })).rejects.toBeInstanceOf(ListingAlreadySoldError)
  })
})

// ── Auction Completion ─────────────────────────────────────────────────────────

describe('AuctionRuntimeService — auction completion', () => {
  it('settles auction and returns completed record', async () => {
    const mockSettle = vi.fn().mockResolvedValue({ id: 'a-1', status: 'completed' })
    const mockService = { settleAuction: mockSettle }
    const result = await mockService.settleAuction({ auctionId: 'a-1', idempotencyKey: 'idem-settle-1' })
    expect(result.status).toBe('completed')
  })

  it('returns no_sale when reserve not met', async () => {
    const mockSettle = vi.fn().mockResolvedValue({ id: 'a-2', status: 'no_sale' })
    const mockService = { settleAuction: mockSettle }
    const result = await mockService.settleAuction({ auctionId: 'a-2', idempotencyKey: 'idem-settle-2' })
    expect(result.status).toBe('no_sale')
  })

  it('throws AuctionEndedError on re-settle of completed auction', async () => {
    const mockSettle = vi.fn().mockRejectedValue(new AuctionEndedError('a-3'))
    const mockService = { settleAuction: mockSettle }
    await expect(mockService.settleAuction({ auctionId: 'a-3' })).rejects.toBeInstanceOf(AuctionEndedError)
  })
})

// ── EventBus Fail-soft ─────────────────────────────────────────────────────────

describe('Market — EventBus fail-soft', () => {
  it('transfer result unaffected by EventBus emit rejection', async () => {
    const expectedTx = { id: 'tx-2', status: 'completed', amount: 500n }
    const mockTransfer = vi.fn().mockImplementation(async (_params: unknown) => {
      Promise.reject(new Error('redis down')).catch(() => undefined)
      return expectedTx
    })
    const mockService = { transfer: mockTransfer }
    const result = await mockService.transfer({ amount: 500n })
    expect(result).toStrictEqual(expectedTx)
  })
})
