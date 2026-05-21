import type { RowDataPacket, PoolConnection } from 'mysql2/promise'
import type {
  AtcCommerceTransaction,
  AtcCommerceOrder,
  AtcCommerceReceipt,
  CommerceTotals,
  AtcTaxRule,
  ShopType,
  CommerceOrderType,
} from '@atc/shared-types'
import { ATC_COMMERCE_EVENTS } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { LedgerService, CommitJournalParams } from '@atc/ledger'
import { LedgerError } from '@atc/ledger'
import type { CommercePool } from './pool.js'
import { generateId } from './id.js'
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
} from './errors.js'

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_PURCHASE_QUANTITY = 999
const LOW_STOCK_THRESHOLD = 5
const MAX_INVENTORY_SLOTS = 60

// ── Row types ──────────────────────────────────────────────────────────────────

interface ShopWithItemRow extends RowDataPacket {
  shop_id: string
  shop_name: string
  shop_type: string
  shop_status: string
  shop_currency: string
  seller_account_id: string | null
  buyer_account_id: string | null
  owner_org_id: string | null
  si_id: string
  si_stock: number
  si_price: string
  si_sell_price: string | null
  si_currency: string
  si_min_level: number | null
}

interface TaxRuleRow extends RowDataPacket {
  id: string
  name: string
  category: string
  type: string
  rate: string
  currency: string | null
  applies_to_shop_type: string | null
  target_account_id: string
  is_active: number
}

interface InventorySlotRow extends RowDataPacket {
  slot: number
  item_id: string
  quantity: number
}

interface InventoryCountRow extends RowDataPacket {
  used_slots: number
  owned_quantity: number
}

interface ItemNameRow extends RowDataPacket {
  id: string
  name: string
}

interface OrderRow extends RowDataPacket {
  id: string
  idempotency_key: string
  order_type: string
  status: string
  character_id: string
  shop_id: string
  payer_account_id: string
  payee_account_id: string
  item_id: string
  quantity: number
  unit_price: string
  subtotal_amount: string
  tax_amount: string
  fee_amount: string
  total_amount: string
  currency: string
  journal_id: string | null
  failure_reason: string | null
  created_at: Date
  updated_at: Date
}

interface ReceiptRow extends RowDataPacket {
  id: string
  order_id: string
  order_type: string
  character_id: string
  shop_id: string
  item_id: string
  item_name: string | null
  quantity: number
  unit_price: string
  subtotal_amount: string
  tax_amount: string
  fee_amount: string
  total_amount: string
  currency: string
  journal_id: string
  issued_at: Date
}

// ── Param types ────────────────────────────────────────────────────────────────

export interface PurchaseParams {
  /** Canonical idempotency key — caller must ensure uniqueness per intended purchase. */
  idempotencyKey: string
  characterId: string
  shopId: string
  itemId: string
  quantity: number
  currency: string
  /** Financial account that the buyer is paying from. */
  buyerAccountId: string
}

export interface SellParams {
  /** Canonical idempotency key — caller must ensure uniqueness per intended sell. */
  idempotencyKey: string
  characterId: string
  shopId: string
  itemId: string
  quantity: number
  currency: string
  /** Financial account that the seller (player) receives payment into. */
  sellerAccountId: string
}

export interface ListShopsParams {
  type?: ShopType | undefined
  limit?: number | undefined
  offset?: number | undefined
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowToOrder(row: OrderRow): AtcCommerceOrder {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    orderType: row.order_type as CommerceOrderType,
    status: row.status as 'pending' | 'completed' | 'failed' | 'refunded',
    characterId: row.character_id,
    shopId: row.shop_id,
    payerAccountId: row.payer_account_id,
    payeeAccountId: row.payee_account_id,
    itemId: row.item_id,
    quantity: row.quantity,
    unitPrice: parseFloat(row.unit_price),
    subtotalAmount: parseFloat(row.subtotal_amount),
    taxAmount: parseFloat(row.tax_amount),
    feeAmount: parseFloat(row.fee_amount),
    totalAmount: parseFloat(row.total_amount),
    currency: row.currency,
    journalId: row.journal_id,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToReceipt(row: ReceiptRow): AtcCommerceReceipt {
  return {
    id: row.id,
    orderId: row.order_id,
    orderType: row.order_type as CommerceOrderType,
    characterId: row.character_id,
    shopId: row.shop_id,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: row.quantity,
    unitPrice: parseFloat(row.unit_price),
    subtotalAmount: parseFloat(row.subtotal_amount),
    taxAmount: parseFloat(row.tax_amount),
    feeAmount: parseFloat(row.fee_amount),
    totalAmount: parseFloat(row.total_amount),
    currency: row.currency,
    journalId: row.journal_id,
    issuedAt: row.issued_at,
  }
}

/**
 * Calculate totals using integer arithmetic to avoid floating-point drift.
 * All intermediate values are in units of 1/10000 (4 decimal places).
 */
function calculateTotals(
  unitPrice: number,
  quantity: number,
  currency: string,
  taxRules: TaxRuleRow[],
): CommerceTotals {
  const unitPriceUnits = Math.round(unitPrice * 10000)
  const subtotalUnits = unitPriceUnits * quantity

  let taxUnits = 0
  let feeUnits = 0
  const taxBreakdown: CommerceTotals['taxBreakdown'] = []
  const feeBreakdown: CommerceTotals['feeBreakdown'] = []

  for (const rule of taxRules) {
    const rate = parseFloat(rule.rate)
    let ruleUnits: number
    if (rule.type === 'percentage') {
      ruleUnits = Math.round(subtotalUnits * rate / 100)
    } else {
      ruleUnits = Math.round(rate * 10000)
    }
    const amount = ruleUnits / 10000
    if (rule.category === 'tax') {
      taxUnits += ruleUnits
      taxBreakdown.push({ ruleId: rule.id, name: rule.name, amount })
    } else {
      feeUnits += ruleUnits
      feeBreakdown.push({ ruleId: rule.id, name: rule.name, amount })
    }
  }

  const totalUnits = subtotalUnits + taxUnits + feeUnits
  return {
    unitPrice,
    subtotal: subtotalUnits / 10000,
    tax: taxUnits / 10000,
    fee: feeUnits / 10000,
    total: totalUnits / 10000,
    currency,
    taxBreakdown,
    feeBreakdown,
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

export class CommerceService {
  constructor(
    private readonly pool: CommercePool,
    private readonly ledger: LedgerService,
    private readonly eventBus?: { emit: (event: string, payload: unknown) => unknown },
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  /**
   * Execute a purchase: player buys an item from a shop.
   *
   * All mutations (ledger journal, inventory add, stock decrement, order, receipt)
   * happen in a single DB transaction — any failure rolls back everything.
   * Idempotency: returns the existing order+receipt on key replay.
   */
  async purchase(params: PurchaseParams): Promise<AtcCommerceTransaction> {
    if (!params.idempotencyKey || params.idempotencyKey.length > 256) {
      throw new CommerceValidationError('idempotencyKey must be a non-empty string of at most 256 characters')
    }
    if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
      throw new CommerceValidationError('Quantity must be a positive integer')
    }
    if (params.quantity > MAX_PURCHASE_QUANTITY) {
      throw new CommerceValidationError(`Quantity ${params.quantity} exceeds maximum ${MAX_PURCHASE_QUANTITY}`)
    }

    const orderId = generateId()
    const receiptId = generateId()

    // isReplay: set true when we detect an idempotency hit — suppresses ORDER_FAILED
    // on any subsequent fetch error (original purchase already succeeded).
    let isReplay = false

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // ── Idempotency check ─────────────────────────────────────────────────
      const [existingRows] = await conn.execute<OrderRow[]>(
        'SELECT * FROM atc_commerce_orders WHERE idempotency_key = ? LIMIT 1',
        [params.idempotencyKey],
      )
      if (existingRows[0]) {
        isReplay = true
        await conn.rollback()
        return await this._fetchExistingTransaction(params.idempotencyKey)
      }

      // ── Lock shop + shop item (FOR UPDATE prevents concurrent stock mutation) ──
      const [shopRows] = await conn.execute<ShopWithItemRow[]>(
        `SELECT s.id AS shop_id, s.name AS shop_name, s.type AS shop_type, s.status AS shop_status,
                s.currency AS shop_currency, s.seller_account_id, s.buyer_account_id, s.owner_org_id,
                si.id AS si_id, si.stock AS si_stock, si.price AS si_price,
                si.sell_price AS si_sell_price, si.currency AS si_currency, si.min_level AS si_min_level
         FROM atc_shops s
         JOIN atc_shop_items si ON si.shop_id = s.id AND si.item_id = ?
         WHERE s.id = ?
         FOR UPDATE`,
        [params.itemId, params.shopId],
      )
      const shopRow = shopRows[0]
      if (!shopRow) {
        await conn.rollback()
        throw new CommerceShopItemNotFoundError(params.shopId, params.itemId)
      }
      if (shopRow.shop_status !== 'active') {
        await conn.rollback()
        throw new CommerceShopNotActiveError(params.shopId, shopRow.shop_status)
      }
      if (shopRow.si_currency !== params.currency) {
        await conn.rollback()
        throw new CommerceCurrencyMismatchError(shopRow.si_currency, params.currency)
      }
      if (shopRow.si_stock !== -1 && shopRow.si_stock < params.quantity) {
        await conn.rollback()
        throw new CommerceInsufficientStockError(params.shopId, params.itemId, shopRow.si_stock, params.quantity)
      }
      if (!shopRow.seller_account_id) {
        await conn.rollback()
        throw new CommerceShopMisconfiguredError(params.shopId, 'no seller_account_id configured')
      }

      // ── Fetch item name for receipt ───────────────────────────────────────
      const [itemRows] = await conn.execute<ItemNameRow[]>(
        'SELECT id, name FROM atc_item_definitions WHERE id = ? LIMIT 1',
        [params.itemId],
      )
      const itemName = itemRows[0]?.name ?? null

      // ── Validate inventory capacity ───────────────────────────────────────
      const [invCountRows] = await conn.execute<InventoryCountRow[]>(
        `SELECT COUNT(DISTINCT slot) AS used_slots,
                COALESCE(SUM(CASE WHEN item_id = ? THEN quantity ELSE 0 END), 0) AS owned_quantity
         FROM atc_character_inventory
         WHERE character_id = ?
         FOR UPDATE`,
        [params.itemId, params.characterId],
      )
      const usedSlots = invCountRows[0]?.used_slots ?? 0
      const hasExistingStack = (invCountRows[0]?.owned_quantity ?? 0) > 0

      if (!hasExistingStack && usedSlots >= MAX_INVENTORY_SLOTS) {
        await conn.rollback()
        throw new CommerceInventoryFullError(params.characterId)
      }

      // ── Load active tax/fee rules ─────────────────────────────────────────
      const [taxRuleRows] = await conn.execute<TaxRuleRow[]>(
        `SELECT * FROM atc_tax_rules
         WHERE is_active = 1
           AND (currency IS NULL OR currency = ?)
           AND (applies_to_shop_type IS NULL OR applies_to_shop_type = ?)`,
        [shopRow.si_currency, shopRow.shop_type],
      )

      // ── Calculate totals ──────────────────────────────────────────────────
      const unitPrice = parseFloat(shopRow.si_price)
      const totals = calculateTotals(unitPrice, params.quantity, params.currency, taxRuleRows)

      // ── Build multi-leg ledger entries ────────────────────────────────────
      // buyer debit = total; seller credit = subtotal; tax/fee credits = breakdown
      const entries: CommitJournalParams['entries'] = [
        { accountId: params.buyerAccountId, entryType: 'debit',  amount: totals.total,   currency: params.currency },
        { accountId: shopRow.seller_account_id, entryType: 'credit', amount: totals.subtotal, currency: params.currency },
      ]
      for (const tx of totals.taxBreakdown) {
        const rule = taxRuleRows.find((r) => r.id === tx.ruleId)
        if (!rule) throw new CommerceValidationError(`Tax rule ${tx.ruleId} not found in loaded rules`)
        entries.push({ accountId: rule.target_account_id, entryType: 'credit', amount: tx.amount, currency: params.currency })
      }
      for (const fx of totals.feeBreakdown) {
        const rule = taxRuleRows.find((r) => r.id === fx.ruleId)
        if (!rule) throw new CommerceValidationError(`Fee rule ${fx.ruleId} not found in loaded rules`)
        entries.push({ accountId: rule.target_account_id, entryType: 'credit', amount: fx.amount, currency: params.currency })
      }

      // ── Commit ledger journal (locks financial accounts inside same TX) ───
      const journal = await this.ledger.commitInTransaction(conn, {
        idempotencyKey: params.idempotencyKey,
        description: `Purchase: ${params.quantity}x ${params.itemId} from shop ${params.shopId}`,
        source: 'gameplay',
        entries,
        referenceId: orderId,
        referenceType: 'commerce_order',
      })

      // ── Add item to inventory (stack or new slot) ─────────────────────────
      await this._addInventoryItemInTx(conn, params.characterId, params.itemId, params.quantity)

      // ── Decrement stock (skip if unlimited) ───────────────────────────────
      if (shopRow.si_stock !== -1) {
        await conn.execute(
          `UPDATE atc_shop_items SET stock = stock - ?, updated_at = NOW(3)
           WHERE shop_id = ? AND item_id = ?`,
          [params.quantity, params.shopId, params.itemId],
        )
      }

      // ── Create order ──────────────────────────────────────────────────────
      await conn.execute(
        `INSERT INTO atc_commerce_orders
           (id, idempotency_key, order_type, status, character_id, shop_id,
            payer_account_id, payee_account_id, item_id, quantity,
            unit_price, subtotal_amount, tax_amount, fee_amount, total_amount,
            currency, journal_id, created_at, updated_at)
         VALUES (?, ?, 'purchase', 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          orderId, params.idempotencyKey, params.characterId, params.shopId,
          params.buyerAccountId, shopRow.seller_account_id, params.itemId, params.quantity,
          totals.unitPrice.toFixed(4), totals.subtotal.toFixed(4),
          totals.tax.toFixed(4), totals.fee.toFixed(4), totals.total.toFixed(4),
          params.currency, journal.id,
        ],
      )

      // ── Create receipt ────────────────────────────────────────────────────
      await conn.execute(
        `INSERT INTO atc_commerce_receipts
           (id, order_id, order_type, character_id, shop_id, item_id, item_name, quantity,
            unit_price, subtotal_amount, tax_amount, fee_amount, total_amount, currency, journal_id, issued_at)
         VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          receiptId, orderId, params.characterId, params.shopId, params.itemId, itemName,
          params.quantity, totals.unitPrice.toFixed(4), totals.subtotal.toFixed(4),
          totals.tax.toFixed(4), totals.fee.toFixed(4), totals.total.toFixed(4),
          params.currency, journal.id,
        ],
      )

      await conn.commit()

      this.telemetry?.increment('commerce.purchases_total')

      // ── Emit events (fire-and-forget) ─────────────────────────────────────
      const newStock = shopRow.si_stock === -1 ? -1 : shopRow.si_stock - params.quantity
      void this.eventBus?.emit(ATC_COMMERCE_EVENTS.ORDER_COMPLETED, {
        orderId, characterId: params.characterId, shopId: params.shopId,
        itemId: params.itemId, quantity: params.quantity, total: totals.total, currency: params.currency,
      })
      void this.eventBus?.emit(ATC_COMMERCE_EVENTS.RECEIPT_CREATED, { receiptId, orderId })
      if (newStock !== -1 && newStock <= LOW_STOCK_THRESHOLD && newStock > 0) {
        void this.eventBus?.emit(ATC_COMMERCE_EVENTS.SHOP_LOW_STOCK, {
          shopId: params.shopId, itemId: params.itemId, stock: newStock,
        })
      }
      if (newStock === 0) {
        void this.eventBus?.emit(ATC_COMMERCE_EVENTS.SHOP_OUT_OF_STOCK, {
          shopId: params.shopId, itemId: params.itemId,
        })
      }

      // ── Build return value from in-memory data (avoids second DB round-trip) ──
      const order: AtcCommerceOrder = {
        id: orderId, idempotencyKey: params.idempotencyKey, orderType: 'purchase',
        status: 'completed', characterId: params.characterId, shopId: params.shopId,
        payerAccountId: params.buyerAccountId, payeeAccountId: shopRow.seller_account_id,
        itemId: params.itemId, quantity: params.quantity, unitPrice: totals.unitPrice,
        subtotalAmount: totals.subtotal, taxAmount: totals.tax, feeAmount: totals.fee,
        totalAmount: totals.total, currency: params.currency, journalId: journal.id,
        failureReason: null, createdAt: new Date(), updatedAt: new Date(),
      }
      const receipt: AtcCommerceReceipt = {
        id: receiptId, orderId, orderType: 'purchase', characterId: params.characterId,
        shopId: params.shopId, itemId: params.itemId, itemName,
        quantity: params.quantity, unitPrice: totals.unitPrice, subtotalAmount: totals.subtotal,
        taxAmount: totals.tax, feeAmount: totals.fee, totalAmount: totals.total,
        currency: params.currency, journalId: journal.id, issuedAt: new Date(),
      }
      return { order, receipt, journalId: journal.id }
    } catch (err) {
      try { await conn.rollback() } catch { /* rollback best-effort */ }
      if (!isReplay) {
        void this.eventBus?.emit(ATC_COMMERCE_EVENTS.ORDER_FAILED, {
          characterId: params.characterId, shopId: params.shopId,
          itemId: params.itemId, reason: err instanceof Error ? err.message : String(err),
        })
      }
      throw err
    } finally {
      conn.release()
    }
  }

  /**
   * Execute a sell: player sells an item to a shop.
   *
   * All mutations happen in a single DB transaction.
   * Idempotency: returns the existing order+receipt on key replay.
   */
  async sell(params: SellParams): Promise<AtcCommerceTransaction> {
    if (!params.idempotencyKey || params.idempotencyKey.length > 256) {
      throw new CommerceValidationError('idempotencyKey must be a non-empty string of at most 256 characters')
    }
    if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
      throw new CommerceValidationError('Quantity must be a positive integer')
    }
    if (params.quantity > MAX_PURCHASE_QUANTITY) {
      throw new CommerceValidationError(`Quantity ${params.quantity} exceeds maximum ${MAX_PURCHASE_QUANTITY}`)
    }

    const orderId = generateId()
    const receiptId = generateId()

    // isReplay: set true when we detect an idempotency hit — suppresses ORDER_FAILED
    // on any subsequent fetch error (original sell already succeeded).
    let isReplay = false

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // ── Idempotency check ─────────────────────────────────────────────────
      const [existingRows] = await conn.execute<OrderRow[]>(
        'SELECT * FROM atc_commerce_orders WHERE idempotency_key = ? LIMIT 1',
        [params.idempotencyKey],
      )
      if (existingRows[0]) {
        isReplay = true
        await conn.rollback()
        return await this._fetchExistingTransaction(params.idempotencyKey)
      }

      // ── Lock shop + shop item ─────────────────────────────────────────────
      const [shopRows] = await conn.execute<ShopWithItemRow[]>(
        `SELECT s.id AS shop_id, s.name AS shop_name, s.type AS shop_type, s.status AS shop_status,
                s.currency AS shop_currency, s.seller_account_id, s.buyer_account_id, s.owner_org_id,
                si.id AS si_id, si.stock AS si_stock, si.price AS si_price,
                si.sell_price AS si_sell_price, si.currency AS si_currency, si.min_level AS si_min_level
         FROM atc_shops s
         JOIN atc_shop_items si ON si.shop_id = s.id AND si.item_id = ?
         WHERE s.id = ?
         FOR UPDATE`,
        [params.itemId, params.shopId],
      )
      const shopRow = shopRows[0]
      if (!shopRow) {
        await conn.rollback()
        throw new CommerceShopItemNotFoundError(params.shopId, params.itemId)
      }
      if (shopRow.shop_status !== 'active') {
        await conn.rollback()
        throw new CommerceShopNotActiveError(params.shopId, shopRow.shop_status)
      }
      if (shopRow.si_sell_price === null) {
        await conn.rollback()
        throw new CommerceShopCannotBuyError(params.shopId, params.itemId)
      }
      if (shopRow.si_currency !== params.currency) {
        await conn.rollback()
        throw new CommerceCurrencyMismatchError(shopRow.si_currency, params.currency)
      }
      if (!shopRow.buyer_account_id) {
        await conn.rollback()
        throw new CommerceShopMisconfiguredError(params.shopId, 'no buyer_account_id configured')
      }

      // ── Verify player owns enough of this item (lock inventory FOR UPDATE) ──
      const [invRows] = await conn.execute<InventorySlotRow[]>(
        `SELECT slot, item_id, quantity FROM atc_character_inventory
         WHERE character_id = ? AND item_id = ?
         ORDER BY slot ASC
         FOR UPDATE`,
        [params.characterId, params.itemId],
      )
      const totalOwned = invRows.reduce((sum, r) => sum + r.quantity, 0)
      if (totalOwned < params.quantity) {
        await conn.rollback()
        throw new CommerceInsufficientInventoryError(params.characterId, params.itemId, totalOwned, params.quantity)
      }

      // ── Fetch item name for receipt ───────────────────────────────────────
      const [itemRows] = await conn.execute<ItemNameRow[]>(
        'SELECT id, name FROM atc_item_definitions WHERE id = ? LIMIT 1',
        [params.itemId],
      )
      const itemName = itemRows[0]?.name ?? null

      // ── Load active tax/fee rules ─────────────────────────────────────────
      const [taxRuleRows] = await conn.execute<TaxRuleRow[]>(
        `SELECT * FROM atc_tax_rules
         WHERE is_active = 1
           AND (currency IS NULL OR currency = ?)
           AND (applies_to_shop_type IS NULL OR applies_to_shop_type = ?)`,
        [shopRow.si_currency, shopRow.shop_type],
      )

      // ── Calculate totals (using sell_price, not purchase price) ──────────
      const sellPrice = parseFloat(shopRow.si_sell_price!)
      const totals = calculateTotals(sellPrice, params.quantity, params.currency, taxRuleRows)

      // ── Build ledger entries ──────────────────────────────────────────────
      // Shop (buyer) is debited; player (seller) is credited for subtotal.
      // Tax/fee accounts are credited from the subtotal.
      const entries: CommitJournalParams['entries'] = [
        { accountId: shopRow.buyer_account_id, entryType: 'debit',  amount: totals.total,   currency: params.currency },
        { accountId: params.sellerAccountId,   entryType: 'credit', amount: totals.subtotal, currency: params.currency },
      ]
      for (const tx of totals.taxBreakdown) {
        const rule = taxRuleRows.find((r) => r.id === tx.ruleId)
        if (!rule) throw new CommerceValidationError(`Tax rule ${tx.ruleId} not found in loaded rules`)
        entries.push({ accountId: rule.target_account_id, entryType: 'credit', amount: tx.amount, currency: params.currency })
      }
      for (const fx of totals.feeBreakdown) {
        const rule = taxRuleRows.find((r) => r.id === fx.ruleId)
        if (!rule) throw new CommerceValidationError(`Fee rule ${fx.ruleId} not found in loaded rules`)
        entries.push({ accountId: rule.target_account_id, entryType: 'credit', amount: fx.amount, currency: params.currency })
      }

      // ── Commit ledger journal ─────────────────────────────────────────────
      const journal = await this.ledger.commitInTransaction(conn, {
        idempotencyKey: params.idempotencyKey,
        description: `Sell: ${params.quantity}x ${params.itemId} to shop ${params.shopId}`,
        source: 'gameplay',
        entries,
        referenceId: orderId,
        referenceType: 'commerce_order',
      })

      // ── Remove items from player inventory ────────────────────────────────
      await this._removeInventoryItemsInTx(conn, params.characterId, params.itemId, params.quantity, invRows)

      // ── Increment shop stock (if not unlimited) ───────────────────────────
      if (shopRow.si_stock !== -1) {
        await conn.execute(
          `UPDATE atc_shop_items SET stock = stock + ?, updated_at = NOW(3)
           WHERE shop_id = ? AND item_id = ?`,
          [params.quantity, params.shopId, params.itemId],
        )
      }

      // ── Create order ──────────────────────────────────────────────────────
      await conn.execute(
        `INSERT INTO atc_commerce_orders
           (id, idempotency_key, order_type, status, character_id, shop_id,
            payer_account_id, payee_account_id, item_id, quantity,
            unit_price, subtotal_amount, tax_amount, fee_amount, total_amount,
            currency, journal_id, created_at, updated_at)
         VALUES (?, ?, 'sell', 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          orderId, params.idempotencyKey, params.characterId, params.shopId,
          shopRow.buyer_account_id, params.sellerAccountId, params.itemId, params.quantity,
          totals.unitPrice.toFixed(4), totals.subtotal.toFixed(4),
          totals.tax.toFixed(4), totals.fee.toFixed(4), totals.total.toFixed(4),
          params.currency, journal.id,
        ],
      )

      // ── Create receipt ────────────────────────────────────────────────────
      await conn.execute(
        `INSERT INTO atc_commerce_receipts
           (id, order_id, order_type, character_id, shop_id, item_id, item_name, quantity,
            unit_price, subtotal_amount, tax_amount, fee_amount, total_amount, currency, journal_id, issued_at)
         VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          receiptId, orderId, params.characterId, params.shopId, params.itemId, itemName,
          params.quantity, totals.unitPrice.toFixed(4), totals.subtotal.toFixed(4),
          totals.tax.toFixed(4), totals.fee.toFixed(4), totals.total.toFixed(4),
          params.currency, journal.id,
        ],
      )

      await conn.commit()

      this.telemetry?.increment('commerce.sells_total')

      void this.eventBus?.emit(ATC_COMMERCE_EVENTS.ORDER_COMPLETED, {
        orderId, characterId: params.characterId, shopId: params.shopId,
        itemId: params.itemId, quantity: params.quantity, total: totals.total, currency: params.currency,
      })
      void this.eventBus?.emit(ATC_COMMERCE_EVENTS.RECEIPT_CREATED, { receiptId, orderId })

      const order: AtcCommerceOrder = {
        id: orderId, idempotencyKey: params.idempotencyKey, orderType: 'sell',
        status: 'completed', characterId: params.characterId, shopId: params.shopId,
        payerAccountId: shopRow.buyer_account_id, payeeAccountId: params.sellerAccountId,
        itemId: params.itemId, quantity: params.quantity, unitPrice: totals.unitPrice,
        subtotalAmount: totals.subtotal, taxAmount: totals.tax, feeAmount: totals.fee,
        totalAmount: totals.total, currency: params.currency, journalId: journal.id,
        failureReason: null, createdAt: new Date(), updatedAt: new Date(),
      }
      const receipt: AtcCommerceReceipt = {
        id: receiptId, orderId, orderType: 'sell', characterId: params.characterId,
        shopId: params.shopId, itemId: params.itemId, itemName,
        quantity: params.quantity, unitPrice: totals.unitPrice, subtotalAmount: totals.subtotal,
        taxAmount: totals.tax, feeAmount: totals.fee, totalAmount: totals.total,
        currency: params.currency, journalId: journal.id, issuedAt: new Date(),
      }
      return { order, receipt, journalId: journal.id }
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      if (!isReplay) {
        void this.eventBus?.emit(ATC_COMMERCE_EVENTS.ORDER_FAILED, {
          characterId: params.characterId, shopId: params.shopId,
          itemId: params.itemId, reason: err instanceof Error ? err.message : String(err),
        })
      }
      throw err
    } finally {
      conn.release()
    }
  }

  /**
   * Calculate what a purchase or sell would cost without committing anything.
   */
  async calculateTotals(
    shopId: string,
    itemId: string,
    quantity: number,
    orderType: CommerceOrderType,
  ): Promise<CommerceTotals> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CommerceValidationError('Quantity must be a positive integer')
    }
    const conn = await this.pool.getConnection()
    try {
      const [shopRows] = await conn.execute<ShopWithItemRow[]>(
        `SELECT s.id AS shop_id, s.type AS shop_type, si.price AS si_price,
                si.sell_price AS si_sell_price, si.currency AS si_currency
         FROM atc_shops s JOIN atc_shop_items si ON si.shop_id = s.id AND si.item_id = ?
         WHERE s.id = ? LIMIT 1`,
        [itemId, shopId],
      )
      const shopRow = shopRows[0]
      if (!shopRow) throw new CommerceShopItemNotFoundError(shopId, itemId)

      const currency = shopRow.si_currency
      if (orderType === 'sell' && shopRow.si_sell_price === null) {
        throw new CommerceShopCannotBuyError(shopId, itemId)
      }
      const unitPrice = orderType === 'sell'
        ? parseFloat(shopRow.si_sell_price!)
        : parseFloat(shopRow.si_price)

      const [taxRuleRows] = await conn.execute<TaxRuleRow[]>(
        `SELECT * FROM atc_tax_rules
         WHERE is_active = 1
           AND (currency IS NULL OR currency = ?)
           AND (applies_to_shop_type IS NULL OR applies_to_shop_type = ?)`,
        [currency, shopRow.shop_type],
      )
      return calculateTotals(unitPrice, quantity, currency, taxRuleRows)
    } finally {
      conn.release()
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Add items to a character's inventory within an existing transaction.
   * Merges into existing stacks (UNIQUE(character_id, slot) constraint).
   * If no stack exists, inserts into the first free slot.
   */
  private async _addInventoryItemInTx(
    conn: PoolConnection,
    characterId: string,
    itemId: string,
    quantity: number,
  ): Promise<void> {
    // Try to merge into an existing stack
    const [updateResult] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
      `UPDATE atc_character_inventory
       SET quantity = quantity + ?, updated_at = NOW(3)
       WHERE character_id = ? AND item_id = ?
       LIMIT 1`,
      [quantity, characterId, itemId],
    )
    if (updateResult.affectedRows > 0) return // merged into existing stack

    // Find the first free slot (FOR UPDATE prevents concurrent slot allocation race)
    const [usedRows] = await conn.execute<(RowDataPacket & { slot: number })[]>(
      `SELECT slot FROM atc_character_inventory WHERE character_id = ? ORDER BY slot ASC FOR UPDATE`,
      [characterId],
    )
    const usedSlots = new Set(usedRows.map((r) => r.slot))
    let freeSlot: number | null = null
    for (let s = 1; s <= MAX_INVENTORY_SLOTS; s++) {
      if (!usedSlots.has(s)) { freeSlot = s; break }
    }
    if (freeSlot === null) throw new CommerceInventoryFullError(characterId)

    const slotId = generateId()
    await conn.execute(
      `INSERT INTO atc_character_inventory (id, character_id, item_id, slot, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [slotId, characterId, itemId, freeSlot, quantity],
    )
  }

  /**
   * Remove items from a character's inventory within an existing transaction.
   * Removes from lowest-slot stacks first, deletes empty stacks.
   */
  private async _removeInventoryItemsInTx(
    conn: PoolConnection,
    characterId: string,
    itemId: string,
    quantity: number,
    lockedRows: InventorySlotRow[],
  ): Promise<void> {
    let remaining = quantity
    for (const row of lockedRows) {
      if (remaining <= 0) break
      if (row.quantity <= remaining) {
        await conn.execute(
          `DELETE FROM atc_character_inventory WHERE character_id = ? AND slot = ?`,
          [characterId, row.slot],
        )
        remaining -= row.quantity
      } else {
        await conn.execute(
          `UPDATE atc_character_inventory SET quantity = quantity - ?, updated_at = NOW(3)
           WHERE character_id = ? AND slot = ?`,
          [remaining, characterId, row.slot],
        )
        remaining = 0
      }
    }
  }

  /**
   * Fetch an existing completed transaction by idempotency key.
   * Called when the key was already processed — returns the durable result.
   */
  private async _fetchExistingTransaction(idempotencyKey: string): Promise<AtcCommerceTransaction> {
    const conn = await this.pool.getConnection()
    try {
      const [orderRows] = await conn.execute<OrderRow[]>(
        'SELECT * FROM atc_commerce_orders WHERE idempotency_key = ? LIMIT 1',
        [idempotencyKey],
      )
      const orderRow = orderRows[0]
      if (!orderRow) throw new Error(`Order not found for idempotency key: ${idempotencyKey}`)

      const [receiptRows] = await conn.execute<ReceiptRow[]>(
        'SELECT * FROM atc_commerce_receipts WHERE order_id = ? LIMIT 1',
        [orderRow.id],
      )
      const receiptRow = receiptRows[0]
      if (!receiptRow) throw new Error(`Receipt not found for order: ${orderRow.id}`)

      const order = rowToOrder(orderRow)
      const receipt = rowToReceipt(receiptRow)
      return { order, receipt, journalId: order.journalId ?? receiptRow.journal_id }
    } finally {
      conn.release()
    }
  }
}

// Suppress unused import warning — LedgerError is used in instanceof checks by callers
void LedgerError
