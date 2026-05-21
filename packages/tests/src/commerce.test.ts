import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolConnection } from 'mysql2/promise'
import { CommerceService } from '@atc/commerce'
import {
  CommerceValidationError,
  CommerceShopNotFoundError,
  CommerceShopNotActiveError,
  CommerceShopItemNotFoundError,
  CommerceInsufficientStockError,
  CommerceShopCannotBuyError,
  CommerceCurrencyMismatchError,
  CommerceInsufficientInventoryError,
  CommerceInventoryFullError,
  CommerceShopMisconfiguredError,
} from '@atc/commerce'
import type { CommercePool } from '@atc/commerce'
import type { LedgerService } from '@atc/ledger'

// ── Mock helpers ───────────────────────────────────────────────────────────────

function makeConn(executeImpl: (sql: string, values?: unknown[]) => Promise<unknown[][]>): PoolConnection {
  return {
    execute: vi.fn(executeImpl) as PoolConnection['execute'],
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  } as unknown as PoolConnection
}

function makePool(conn: PoolConnection): CommercePool {
  return { getConnection: vi.fn().mockResolvedValue(conn) }
}

function makeLedger(journalId = 'jrn-1'): LedgerService {
  return {
    commitInTransaction: vi.fn().mockResolvedValue({ id: journalId }),
  } as unknown as LedgerService
}

// ── Fixture rows ───────────────────────────────────────────────────────────────

function shopRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    shop_id:          'shop-1',
    shop_name:        'Test Shop',
    shop_type:        'general',
    shop_status:      'active',
    shop_currency:    'USD',
    seller_account_id: 'acct-seller',
    buyer_account_id:  'acct-buyer',
    owner_org_id:      null,
    si_id:            'si-1',
    si_stock:         100,
    si_price:         '10.0000',
    si_sell_price:    '5.0000',
    si_currency:      'USD',
    si_min_level:     null,
    ...overrides,
  }
}

function orderRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id:               'ord-1',
    idempotency_key:  'idem-1',
    order_type:       'purchase',
    status:           'completed',
    character_id:     'char-1',
    shop_id:          'shop-1',
    payer_account_id:  'acct-buyer-char',
    payee_account_id:  'acct-seller',
    item_id:          'item-1',
    quantity:         1,
    unit_price:       '10.0000',
    subtotal_amount:  '10.0000',
    tax_amount:       '0.0000',
    fee_amount:       '0.0000',
    total_amount:     '10.0000',
    currency:         'USD',
    journal_id:       'jrn-1',
    failure_reason:   null,
    created_at:       new Date(),
    updated_at:       new Date(),
    ...overrides,
  }
}

function receiptRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id:               'rec-1',
    order_id:         'ord-1',
    order_type:       'purchase',
    character_id:     'char-1',
    shop_id:          'shop-1',
    item_id:          'item-1',
    item_name:        'Test Item',
    quantity:         1,
    unit_price:       '10.0000',
    subtotal_amount:  '10.0000',
    tax_amount:       '0.0000',
    fee_amount:       '0.0000',
    total_amount:     '10.0000',
    currency:         'USD',
    journal_id:       'jrn-1',
    issued_at:        new Date(),
    ...overrides,
  }
}

function invCountRow(usedSlots = 0, ownedQuantity = 0) {
  return { used_slots: usedSlots, owned_quantity: ownedQuantity }
}

function invSlotRow(slot = 1, quantity = 5) {
  return { slot, item_id: 'item-1', quantity }
}

// ── Shared execute factory ──────────────────────────────────────────────────────
// Builds a mock execute that routes calls based on SQL patterns.

function makeExecute(config: {
  existingOrder?: Record<string, unknown>
  shop?: Record<string, unknown>
  itemName?: string | null
  invCount?: { used_slots: number; owned_quantity: number }
  invSlots?: Array<{ slot: number; item_id: string; quantity: number }>
  taxRules?: unknown[]
  usedSlots?: number[]
  existingOrderForFetch?: Record<string, unknown>
  receiptForFetch?: Record<string, unknown>
}) {
  return async (sql: string) => {
    // Idempotency check — return existing if provided
    if (sql.includes('idempotency_key') && sql.includes('atc_commerce_orders')) {
      if (config.existingOrder) return [[config.existingOrder], []]
      return [[], []]
    }
    // Shop + item lock
    if (sql.includes('atc_shops') && sql.includes('FOR UPDATE')) {
      return [[config.shop ?? shopRow()], []]
    }
    // Item name
    if (sql.includes('atc_item_definitions')) {
      const name = config.itemName !== undefined ? config.itemName : 'Test Item'
      return name !== null ? [[{ id: 'item-1', name }], []] : [[], []]
    }
    // Inventory count (purchase path)
    if (sql.includes('used_slots') && sql.includes('FOR UPDATE')) {
      return [[config.invCount ?? invCountRow()], []]
    }
    // Inventory slots for sell (FOR UPDATE, no COUNT)
    if (sql.includes('atc_character_inventory') && sql.includes('FOR UPDATE')) {
      return [[...(config.invSlots ?? [invSlotRow(1, 10)])], []]
    }
    // Tax rules
    if (sql.includes('atc_tax_rules')) {
      return [[...(config.taxRules ?? [])], []]
    }
    // Free slot query for _addInventoryItemInTx
    if (sql.includes('atc_character_inventory') && !sql.includes('FOR UPDATE')) {
      const usedSlots = (config.usedSlots ?? []).map((s) => ({ slot: s }))
      return [usedSlots, []]
    }
    // INSERT / UPDATE — return affectedRows = 1
    if (sql.startsWith('INSERT') || sql.startsWith('UPDATE') || sql.startsWith('DELETE')) {
      return [{ affectedRows: 1 }, []]
    }
    return [[], []]
  }
}

// ── CommerceService.purchase — validation ──────────────────────────────────────

describe('CommerceService.purchase — validation', () => {
  let svc: CommerceService

  beforeEach(() => {
    svc = new CommerceService(makePool(makeConn(async () => [[]])), makeLedger())
  })

  it('throws CommerceValidationError for zero quantity', async () => {
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 0, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })

  it('throws CommerceValidationError for negative quantity', async () => {
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: -5, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })

  it('throws CommerceValidationError for fractional quantity', async () => {
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 1.5, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })

  it('throws CommerceValidationError for quantity > 999', async () => {
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 1000, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })
})

// ── CommerceService.purchase — shop/item checks ────────────────────────────────

describe('CommerceService.purchase — shop/item checks', () => {
  it('throws CommerceShopItemNotFoundError when shop/item row is absent', async () => {
    const conn = makeConn(makeExecute({ shop: undefined }))
    // Override shop query to return empty
    vi.spyOn(conn, 'execute').mockImplementation(async (sql: unknown) => {
      const s = sql as string
      if (s.includes('idempotency_key')) return [[], []] as unknown as never
      if (s.includes('atc_shops'))       return [[], []] as unknown as never
      return [[], []] as unknown as never
    })
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-missing',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceShopItemNotFoundError)
  })

  it('throws CommerceShopNotActiveError when shop status is inactive', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ shop_status: 'inactive' }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceShopNotActiveError)
  })

  it('throws CommerceCurrencyMismatchError when currencies differ', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ si_currency: 'EUR' }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceCurrencyMismatchError)
  })

  it('throws CommerceInsufficientStockError when stock < quantity', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ si_stock: 2 }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 5, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceInsufficientStockError)
  })

  it('does NOT throw for insufficient stock when stock = -1 (unlimited)', async () => {
    // With unlimited stock the service proceeds past the stock check.
    // We trigger a controlled error (ShopMisconfigured) to confirm we got past stock validation.
    const conn = makeConn(makeExecute({
      shop: shopRow({ si_stock: -1, seller_account_id: null }),
    }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceShopMisconfiguredError)
  })

  it('throws CommerceShopMisconfiguredError when seller_account_id is null', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ seller_account_id: null }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceShopMisconfiguredError)
  })
})

// ── CommerceService.purchase — inventory checks ────────────────────────────────

describe('CommerceService.purchase — inventory checks', () => {
  it('throws CommerceInventoryFullError when no slots free and no existing stack', async () => {
    const conn = makeConn(makeExecute({
      invCount: invCountRow(60, 0), // 60 slots used, no existing stack
    }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceInventoryFullError)
  })

  it('does NOT throw inventory full when existing stack is present (merge allowed)', async () => {
    // Has existing stack → skip full check → proceeds to tax rule load → commits successfully
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({
      invCount: invCountRow(60, 5), // all slots taken but item already owned (stack merge)
    }))
    const svc = new CommerceService(makePool(conn), ledger)
    // Should reach ledger.commitInTransaction without throwing inventory full
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).resolves.toBeDefined()
    expect(ledger.commitInTransaction).toHaveBeenCalled()
  })
})

// ── CommerceService.purchase — tax calculation ─────────────────────────────────

describe('CommerceService.purchase — tax/fee calculation', () => {
  it('applies percentage tax rule correctly', async () => {
    const taxRule = {
      id: 'tax-1', name: 'Sales Tax', category: 'tax', type: 'percentage',
      rate: '10.0000', currency: null, applies_to_shop_type: null,
      target_account_id: 'acct-tax', is_active: 1,
    }
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({ taxRules: [taxRule] }))
    const svc = new CommerceService(makePool(conn), ledger)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 2, currency: 'USD', buyerAccountId: 'a1',
    })
    // unit price = 10, qty = 2 → subtotal = 20, tax 10% = 2, total = 22
    const callArgs = (ledger.commitInTransaction as ReturnType<typeof vi.fn>).mock.calls[0]
    const entries: Array<{ entryType: string; amount: number }> = callArgs[1].entries
    const debit = entries.find((e) => e.entryType === 'debit')!
    expect(debit.amount).toBeCloseTo(22, 4)
    const credit = entries.find((e) => e.entryType === 'credit' && e.amount > 1)!
    expect(credit.amount).toBeCloseTo(20, 4) // subtotal to seller
  })

  it('applies flat fee rule correctly', async () => {
    const feeRule = {
      id: 'fee-1', name: 'Transaction Fee', category: 'fee', type: 'flat',
      rate: '1.5000', currency: null, applies_to_shop_type: null,
      target_account_id: 'acct-fee', is_active: 1,
    }
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({ taxRules: [feeRule] }))
    const svc = new CommerceService(makePool(conn), ledger)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    // unit price = 10, qty = 1, fee = 1.50 → total = 11.50
    const callArgs = (ledger.commitInTransaction as ReturnType<typeof vi.fn>).mock.calls[0]
    const entries: Array<{ entryType: string; amount: number }> = callArgs[1].entries
    const debit = entries.find((e) => e.entryType === 'debit')!
    expect(debit.amount).toBeCloseTo(11.5, 4)
  })

  it('produces balanced ledger entries (debits = sum of credits)', async () => {
    const taxRule = {
      id: 'tax-1', name: 'VAT', category: 'tax', type: 'percentage',
      rate: '20.0000', currency: null, applies_to_shop_type: null,
      target_account_id: 'acct-tax', is_active: 1,
    }
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({ taxRules: [taxRule] }))
    const svc = new CommerceService(makePool(conn), ledger)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 3, currency: 'USD', buyerAccountId: 'a1',
    })
    const callArgs = (ledger.commitInTransaction as ReturnType<typeof vi.fn>).mock.calls[0]
    const entries: Array<{ entryType: string; amount: number }> = callArgs[1].entries
    const totalDebit = entries.filter((e) => e.entryType === 'debit').reduce((s, e) => s + e.amount, 0)
    const totalCredit = entries.filter((e) => e.entryType === 'credit').reduce((s, e) => s + e.amount, 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 10)
  })

  it('produces no tax/fee entries when no active rules', async () => {
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({ taxRules: [] }))
    const svc = new CommerceService(makePool(conn), ledger)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    const callArgs = (ledger.commitInTransaction as ReturnType<typeof vi.fn>).mock.calls[0]
    const entries: Array<{ entryType: string; amount: number }> = callArgs[1].entries
    // Only buyer debit + seller credit
    expect(entries).toHaveLength(2)
  })
})

// ── CommerceService.purchase — idempotency ─────────────────────────────────────

describe('CommerceService.purchase — idempotency replay', () => {
  it('returns existing transaction on duplicate idempotency key', async () => {
    const existing = orderRow()
    const receipt = receiptRow()
    const conn = makeConn(async (sql: string) => {
      if (sql.includes('idempotency_key') && sql.includes('atc_commerce_orders') && sql.includes('SELECT')) {
        return [[existing], []]
      }
      // Fetch existing transaction calls
      if (sql.includes('atc_commerce_orders') && !sql.includes('idempotency_key')) return [[existing], []]
      if (sql.includes('atc_commerce_receipts')) return [[receipt], []]
      return [[], []]
    })
    const ledger = makeLedger()
    const svc = new CommerceService(makePool(conn), ledger)
    const result = await svc.purchase({
      idempotencyKey: 'idem-1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    expect(result.order.id).toBe('ord-1')
    expect(result.receipt.id).toBe('rec-1')
    // Ledger must NOT be called again on replay
    expect(ledger.commitInTransaction).not.toHaveBeenCalled()
    // conn.rollback must be called to release the TX
    expect((conn.rollback as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
  })
})

// ── CommerceService.purchase — successful transaction ─────────────────────────

describe('CommerceService.purchase — successful transaction', () => {
  it('returns a complete AtcCommerceTransaction with correct shape', async () => {
    const ledger = makeLedger('jrn-42')
    const conn = makeConn(makeExecute({}))
    const svc = new CommerceService(makePool(conn), ledger)
    const tx = await svc.purchase({
      idempotencyKey: 'k-success', characterId: 'char-1', shopId: 'shop-1',
      itemId: 'item-1', quantity: 1, currency: 'USD', buyerAccountId: 'acct-buyer-char',
    })
    expect(tx.order.orderType).toBe('purchase')
    expect(tx.order.status).toBe('completed')
    expect(tx.order.characterId).toBe('char-1')
    expect(tx.order.currency).toBe('USD')
    expect(tx.journalId).toBe('jrn-42')
    expect(tx.receipt.orderId).toBe(tx.order.id)
    expect(tx.receipt.orderType).toBe('purchase')
  })

  it('calls conn.commit exactly once', async () => {
    const conn = makeConn(makeExecute({}))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    expect((conn.commit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
    expect((conn.rollback as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('releases the connection even on success', async () => {
    const conn = makeConn(makeExecute({}))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    expect((conn.release as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
  })

  it('releases the connection on error (no connection leak)', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ shop_status: 'inactive' }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow()
    expect((conn.release as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
  })

  it('rollback is called on error, NOT on success', async () => {
    const connOk = makeConn(makeExecute({}))
    const svcOk = new CommerceService(makePool(connOk), makeLedger())
    await svcOk.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    expect((connOk.rollback as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()

    const connFail = makeConn(makeExecute({ shop: shopRow({ shop_status: 'inactive' }) }))
    const svcFail = new CommerceService(makePool(connFail), makeLedger())
    await expect(svcFail.purchase({
      idempotencyKey: 'k2', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow()
    expect((connFail.rollback as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
  })
})

// ── CommerceService.sell — validation ─────────────────────────────────────────

describe('CommerceService.sell — validation', () => {
  let svc: CommerceService
  beforeEach(() => {
    svc = new CommerceService(makePool(makeConn(async () => [[]])), makeLedger())
  })

  it('throws CommerceValidationError for zero quantity', async () => {
    await expect(svc.sell({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 0, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })

  it('throws CommerceValidationError for quantity > 999', async () => {
    await expect(svc.sell({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 1000, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })
})

// ── CommerceService.sell — shop/item/inventory checks ─────────────────────────

describe('CommerceService.sell — shop/item/inventory checks', () => {
  it('throws CommerceShopCannotBuyError when sell_price is null', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ si_sell_price: null }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.sell({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow(CommerceShopCannotBuyError)
  })

  it('throws CommerceInsufficientInventoryError when player owns fewer items than requested', async () => {
    const conn = makeConn(makeExecute({
      invSlots: [invSlotRow(1, 2)], // player owns 2
    }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.sell({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'item-1', quantity: 5, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow(CommerceInsufficientInventoryError)
  })

  it('throws CommerceShopMisconfiguredError when buyer_account_id is null', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ buyer_account_id: null }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.sell({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow(CommerceShopMisconfiguredError)
  })

  it('throws CommerceCurrencyMismatchError for sell when currencies differ', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ si_currency: 'EUR' }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.sell({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow(CommerceCurrencyMismatchError)
  })
})

// ── CommerceService.sell — successful transaction ──────────────────────────────

describe('CommerceService.sell — successful transaction', () => {
  it('returns a complete sell transaction with correct shape', async () => {
    const ledger = makeLedger('jrn-sell-1')
    const conn = makeConn(makeExecute({
      invSlots: [invSlotRow(1, 10)],
    }))
    const svc = new CommerceService(makePool(conn), ledger)
    const tx = await svc.sell({
      idempotencyKey: 'k-sell', characterId: 'char-1', shopId: 'shop-1',
      itemId: 'item-1', quantity: 3, currency: 'USD', sellerAccountId: 'acct-player',
    })
    expect(tx.order.orderType).toBe('sell')
    expect(tx.order.status).toBe('completed')
    expect(tx.journalId).toBe('jrn-sell-1')
    expect(tx.receipt.orderType).toBe('sell')
  })

  it('releases connection on sell error', async () => {
    const conn = makeConn(makeExecute({ shop: shopRow({ shop_status: 'maintenance' }) }))
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.sell({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow()
    expect((conn.release as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
  })
})

// ── CommerceService.calculateTotals ───────────────────────────────────────────

describe('CommerceService.calculateTotals', () => {
  it('returns correct totals for purchase without tax rules', async () => {
    const conn = makeConn(async (sql: string) => {
      if (sql.includes('atc_shops')) return [[{ shop_id: 's1', shop_type: 'general', si_price: '10.0000', si_sell_price: '5.0000', si_currency: 'USD' }], []]
      if (sql.includes('atc_tax_rules')) return [[], []]
      return [[], []]
    })
    const svc = new CommerceService(makePool(conn), makeLedger())
    const totals = await svc.calculateTotals('shop-1', 'item-1', 5, 'purchase')
    expect(totals.unitPrice).toBe(10)
    expect(totals.subtotal).toBe(50)
    expect(totals.tax).toBe(0)
    expect(totals.fee).toBe(0)
    expect(totals.total).toBe(50)
    expect(totals.currency).toBe('USD')
  })

  it('uses sell_price for sell order type', async () => {
    const conn = makeConn(async (sql: string) => {
      if (sql.includes('atc_shops')) return [[{ shop_id: 's1', shop_type: 'general', si_price: '10.0000', si_sell_price: '3.0000', si_currency: 'USD' }], []]
      if (sql.includes('atc_tax_rules')) return [[], []]
      return [[], []]
    })
    const svc = new CommerceService(makePool(conn), makeLedger())
    const totals = await svc.calculateTotals('shop-1', 'item-1', 2, 'sell')
    expect(totals.unitPrice).toBe(3)
    expect(totals.subtotal).toBe(6)
    expect(totals.total).toBe(6)
  })

  it('throws CommerceShopItemNotFoundError if shop/item not found', async () => {
    const conn = makeConn(async (sql: string) => {
      if (sql.includes('atc_shops')) return [[], []]
      return [[], []]
    })
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.calculateTotals('shop-x', 'item-x', 1, 'purchase')).rejects.toThrow(CommerceShopItemNotFoundError)
  })
})

// ── CommerceService — event emission ──────────────────────────────────────────

describe('CommerceService — event emission', () => {
  it('emits ORDER_COMPLETED and RECEIPT_CREATED after successful purchase', async () => {
    const eventBus = { emit: vi.fn() }
    const conn = makeConn(makeExecute({}))
    const svc = new CommerceService(makePool(conn), makeLedger(), eventBus)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    const emittedEvents = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(emittedEvents).toContain('atc:commerce:order:completed')
    expect(emittedEvents).toContain('atc:commerce:receipt:created')
  })

  it('emits ORDER_FAILED on purchase error', async () => {
    const eventBus = { emit: vi.fn() }
    const conn = makeConn(makeExecute({ shop: shopRow({ shop_status: 'inactive' }) }))
    const svc = new CommerceService(makePool(conn), makeLedger(), eventBus)
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow()
    const emittedEvents = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(emittedEvents).toContain('atc:commerce:order:failed')
  })

  it('emits SHOP_LOW_STOCK when remaining stock is <= 5', async () => {
    const eventBus = { emit: vi.fn() }
    const conn = makeConn(makeExecute({ shop: shopRow({ si_stock: 6 }) }))
    const svc = new CommerceService(makePool(conn), makeLedger(), eventBus)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 2, currency: 'USD', buyerAccountId: 'a1',
    })
    // stock was 6, purchased 2, remaining 4 → low stock
    const emittedEvents = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(emittedEvents).toContain('atc:commerce:shop:low_stock')
  })

  it('emits SHOP_OUT_OF_STOCK when stock reaches 0', async () => {
    const eventBus = { emit: vi.fn() }
    const conn = makeConn(makeExecute({ shop: shopRow({ si_stock: 1 }) }))
    const svc = new CommerceService(makePool(conn), makeLedger(), eventBus)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })
    const emittedEvents = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(emittedEvents).toContain('atc:commerce:shop:out_of_stock')
  })

  it('does NOT emit SHOP_LOW_STOCK or SHOP_OUT_OF_STOCK for unlimited stock', async () => {
    const eventBus = { emit: vi.fn() }
    const conn = makeConn(makeExecute({ shop: shopRow({ si_stock: -1 }) }))
    const svc = new CommerceService(makePool(conn), makeLedger(), eventBus)
    await svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 999, currency: 'USD', buyerAccountId: 'a1',
    })
    const emittedEvents = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(emittedEvents).not.toContain('atc:commerce:shop:low_stock')
    expect(emittedEvents).not.toContain('atc:commerce:shop:out_of_stock')
  })
})

// ── CommerceService — anti-dupe hardening ─────────────────────────────────────

describe('CommerceService — anti-dupe / rollback correctness', () => {
  it('does not call commitInTransaction when shop validation fails', async () => {
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({ shop: shopRow({ shop_status: 'inactive' }) }))
    const svc = new CommerceService(makePool(conn), ledger)
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow()
    expect(ledger.commitInTransaction).not.toHaveBeenCalled()
  })

  it('does not call commitInTransaction when inventory is full', async () => {
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({ invCount: invCountRow(60, 0) }))
    const svc = new CommerceService(makePool(conn), ledger)
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow()
    expect(ledger.commitInTransaction).not.toHaveBeenCalled()
  })

  it('does not issue a receipt when order fails', async () => {
    const insertCalls: string[] = []
    const conn = makeConn(async (sql: string) => {
      if (sql.includes('atc_commerce_receipts') && sql.startsWith('INSERT')) {
        insertCalls.push('receipt-insert')
      }
      if (sql.includes('idempotency_key')) return [[], []]
      if (sql.includes('atc_shops') && sql.includes('FOR UPDATE')) {
        return [[shopRow({ shop_status: 'inactive' })], []]
      }
      return [[], []]
    })
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow()
    expect(insertCalls).toHaveLength(0)
  })
})

// ── Hardening: idempotencyKey validation ──────────────────────────────────────

describe('CommerceService — hardening: idempotencyKey validation', () => {
  it('throws CommerceValidationError for empty idempotencyKey (purchase)', async () => {
    const svc = new CommerceService(makePool(makeConn(async () => [[]])), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: '', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })

  it('throws CommerceValidationError for empty idempotencyKey (sell)', async () => {
    const svc = new CommerceService(makePool(makeConn(async () => [[]])), makeLedger())
    await expect(svc.sell({
      idempotencyKey: '', characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 1, currency: 'USD', sellerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })

  it('throws CommerceValidationError for idempotencyKey longer than 256 characters', async () => {
    const svc = new CommerceService(makePool(makeConn(async () => [[]])), makeLedger())
    await expect(svc.purchase({
      idempotencyKey: 'x'.repeat(257), characterId: 'c1', shopId: 's1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow(CommerceValidationError)
  })
})

// ── Hardening: ledger failure rolls back the whole transaction ────────────────

describe('CommerceService — hardening: ledger failure rolls back', () => {
  it('rolls back, does NOT commit, and emits ORDER_FAILED when ledger throws', async () => {
    const ledger = {
      commitInTransaction: vi.fn().mockRejectedValue(new Error('ledger failure')),
    } as unknown as LedgerService
    const eventBus = { emit: vi.fn() }
    const conn = makeConn(makeExecute({}))
    const svc = new CommerceService(makePool(conn), ledger, eventBus)
    await expect(svc.purchase({
      idempotencyKey: 'k1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow('ledger failure')
    expect((conn.rollback as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    expect((conn.commit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    const emitted = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(emitted).not.toContain('atc:commerce:order:completed')
    expect(emitted).toContain('atc:commerce:order:failed')
  })
})

// ── Hardening: ORDER_FAILED suppressed on idempotency replay fetch failure ────

describe('CommerceService — hardening: ORDER_FAILED suppressed on replay fetch failure', () => {
  it('does not emit ORDER_FAILED when _fetchExistingTransaction fails after idempotency hit', async () => {
    const eventBus = { emit: vi.fn() }
    const existing = orderRow()

    // conn1 is the main purchase TX — detects existing order and sets isReplay = true
    const conn1 = makeConn(async (sql: string) => {
      if (sql.includes('idempotency_key')) return [[existing], []]
      return [[], []]
    })
    // conn2 is used by _fetchExistingTransaction — simulates a transient DB failure
    const conn2 = makeConn(async () => { throw new Error('fetch transient error') })

    const pool: CommercePool = {
      getConnection: vi.fn()
        .mockResolvedValueOnce(conn1)
        .mockResolvedValueOnce(conn2),
    }
    const svc = new CommerceService(pool, makeLedger(), eventBus)
    await expect(svc.purchase({
      idempotencyKey: 'idem-1', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 1, currency: 'USD', buyerAccountId: 'a1',
    })).rejects.toThrow('fetch transient error')
    // ORDER_FAILED must NOT fire — the original purchase succeeded; this error is in the replay path
    const emitted = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(emitted).not.toContain('atc:commerce:order:failed')
  })
})

// ── Hardening: calculateTotals null sell_price and quantity guard ─────────────

describe('CommerceService — hardening: calculateTotals guards', () => {
  it('throws CommerceShopCannotBuyError when sell_price is null', async () => {
    const conn = makeConn(async (sql: string) => {
      if (sql.includes('atc_shops')) {
        return [[{
          shop_id: 'shop-1', shop_type: 'npc',
          si_price: '10.0000', si_sell_price: null, si_currency: 'USD',
        }], []]
      }
      return [[], []]
    })
    const svc = new CommerceService(makePool(conn), makeLedger())
    await expect(svc.calculateTotals('shop-1', 'item-1', 1, 'sell')).rejects.toThrow(CommerceShopCannotBuyError)
  })

  it('throws CommerceValidationError for quantity < 1', async () => {
    const svc = new CommerceService(makePool(makeConn(async () => [[]])), makeLedger())
    await expect(svc.calculateTotals('shop-1', 'item-1', 0, 'purchase')).rejects.toThrow(CommerceValidationError)
  })
})

// ── Hardening: multi-rule ledger balance and org revenue routing ──────────────

describe('CommerceService — hardening: multi-rule balance and org revenue routing', () => {
  it('produces balanced entries with multiple tax and fee rules, credits routed to correct accounts', async () => {
    const rules = [
      {
        id: 'tax-1', name: 'State Tax', category: 'tax', type: 'percentage',
        rate: '5.0000', currency: null, applies_to_shop_type: null,
        target_account_id: 'acct-state', is_active: 1,
      },
      {
        id: 'tax-2', name: 'Federal Tax', category: 'tax', type: 'percentage',
        rate: '3.0000', currency: null, applies_to_shop_type: null,
        target_account_id: 'acct-federal', is_active: 1,
      },
      {
        id: 'fee-1', name: 'Handling Fee', category: 'fee', type: 'flat',
        rate: '0.5000', currency: null, applies_to_shop_type: null,
        target_account_id: 'acct-ops', is_active: 1,
      },
    ]
    const ledger = makeLedger()
    const conn = makeConn(makeExecute({ taxRules: rules }))
    const svc = new CommerceService(makePool(conn), ledger)
    // unit price = 10, qty = 4 → subtotal = 40
    // state tax 5% = 2, federal tax 3% = 1.2, handling fee flat 0.5 → total = 43.7
    await svc.purchase({
      idempotencyKey: 'k-multi', characterId: 'c1', shopId: 'shop-1',
      itemId: 'i1', quantity: 4, currency: 'USD', buyerAccountId: 'acct-buyer',
    })
    const entries: Array<{ entryType: string; amount: number; accountId: string }> =
      (ledger.commitInTransaction as ReturnType<typeof vi.fn>).mock.calls[0][1].entries

    const totalDebit = entries.filter((e) => e.entryType === 'debit').reduce((s, e) => s + e.amount, 0)
    const totalCredit = entries.filter((e) => e.entryType === 'credit').reduce((s, e) => s + e.amount, 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 10)

    // Each tax/fee account receives its own credit entry
    expect(entries.some((e) => e.accountId === 'acct-state' && e.entryType === 'credit')).toBe(true)
    expect(entries.some((e) => e.accountId === 'acct-federal' && e.entryType === 'credit')).toBe(true)
    expect(entries.some((e) => e.accountId === 'acct-ops' && e.entryType === 'credit')).toBe(true)

    // Buyer debit = subtotal + state tax + federal tax + fee
    const debit = entries.find((e) => e.entryType === 'debit')!
    expect(debit.amount).toBeCloseTo(43.7, 4)
  })
})
