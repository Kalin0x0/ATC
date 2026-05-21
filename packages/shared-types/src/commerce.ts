// ── Shop ──────────────────────────────────────────────────────────────────────

export type ShopType = 'npc' | 'player' | 'organization' | 'vending' | 'admin'
export type ShopStatus = 'active' | 'disabled' | 'maintenance'

export interface AtcShop {
  id: string
  name: string
  type: ShopType
  status: ShopStatus
  ownerOrgId: string | null
  /** Financial account that receives revenue when players purchase items. */
  sellerAccountId: string | null
  /** Financial account that pays players when shop buys items. */
  buyerAccountId: string | null
  currency: string
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcShopItem {
  id: string
  shopId: string
  itemId: string
  /** -1 = unlimited stock */
  stock: number
  /** Price the shop charges when a player buys this item. */
  price: number
  /** Price the shop pays when a player sells this item. null = shop does not buy. */
  sellPrice: number | null
  currency: string
  minLevel: number | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

// ── Orders ───────────────────────────────────────────────────────────────────

export type CommerceOrderType = 'purchase' | 'sell'
export type CommerceOrderStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface AtcCommerceOrder {
  id: string
  idempotencyKey: string
  orderType: CommerceOrderType
  status: CommerceOrderStatus
  characterId: string
  shopId: string
  /** Account debited (buyer) */
  payerAccountId: string
  /** Account credited (seller) */
  payeeAccountId: string
  itemId: string
  quantity: number
  unitPrice: number
  subtotalAmount: number
  taxAmount: number
  feeAmount: number
  totalAmount: number
  currency: string
  journalId: string | null
  failureReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcCommerceOrderPage {
  items: AtcCommerceOrder[]
  total: number
  offset: number
  limit: number
}

// ── Receipts ──────────────────────────────────────────────────────────────────

export interface AtcCommerceReceipt {
  id: string
  orderId: string
  orderType: CommerceOrderType
  characterId: string
  shopId: string
  itemId: string
  itemName: string | null
  quantity: number
  unitPrice: number
  subtotalAmount: number
  taxAmount: number
  feeAmount: number
  totalAmount: number
  currency: string
  journalId: string
  issuedAt: Date
}

export interface AtcCommerceReceiptPage {
  items: AtcCommerceReceipt[]
  total: number
  offset: number
  limit: number
}

// ── Tax / Fee rules ───────────────────────────────────────────────────────────

export type TaxRuleType = 'percentage' | 'flat'
export type TaxRuleCategory = 'tax' | 'fee'

export interface AtcTaxRule {
  id: string
  name: string
  category: TaxRuleCategory
  type: TaxRuleType
  /** Percentage 0–100 for 'percentage'; fixed amount for 'flat'. */
  rate: number
  /** null = applies to all currencies */
  currency: string | null
  /** null = applies to all shop types */
  appliesToShopType: ShopType | null
  /** Financial account that receives the collected tax/fee. */
  targetAccountId: string
  isActive: boolean
  createdAt: Date
}

// ── Commerce transaction result ───────────────────────────────────────────────

export interface AtcCommerceTransaction {
  order: AtcCommerceOrder
  receipt: AtcCommerceReceipt
  journalId: string
}

// ── Commerce totals ───────────────────────────────────────────────────────────

export interface CommerceTotals {
  unitPrice: number
  subtotal: number
  tax: number
  fee: number
  total: number
  currency: string
  taxBreakdown: Array<{ ruleId: string; name: string; amount: number }>
  feeBreakdown: Array<{ ruleId: string; name: string; amount: number }>
}

// ── Events ───────────────────────────────────────────────────────────────────

export const ATC_COMMERCE_EVENTS = {
  ORDER_CREATED:      'atc:commerce:order:created',
  ORDER_COMPLETED:    'atc:commerce:order:completed',
  ORDER_FAILED:       'atc:commerce:order:failed',
  RECEIPT_CREATED:    'atc:commerce:receipt:created',
  SHOP_LOW_STOCK:     'atc:commerce:shop:low_stock',
  SHOP_OUT_OF_STOCK:  'atc:commerce:shop:out_of_stock',
} as const

export type AtcCommerceEventName = typeof ATC_COMMERCE_EVENTS[keyof typeof ATC_COMMERCE_EVENTS]
