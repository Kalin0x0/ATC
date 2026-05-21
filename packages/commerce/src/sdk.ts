import type {
  AtcShopItem,
  AtcCommerceTransaction,
  AtcCommerceOrder,
  AtcCommerceOrderPage,
  AtcCommerceReceipt,
  AtcCommerceReceiptPage,
  AtcTaxRule,
  CommerceTotals,
} from '@atc/shared-types'
import type { CommerceService } from './commerce.service.js'
import type { ShopRepository, ShopPage, CreateShopParams, ListShopsParams } from './shop.repository.js'
import type { ShopItemRepository, UpsertShopItemParams } from './shop-item.repository.js'
import type { OrderRepository, ListOrdersParams } from './order.repository.js'
import type { ReceiptRepository, ListReceiptsParams } from './receipt.repository.js'
import type { TaxRuleRepository, CreateTaxRuleParams } from './tax.repository.js'
import type { PurchaseParams, SellParams } from './commerce.service.js'
import type { AtcShop, ShopStatus } from '@atc/shared-types'

export class AtcCommerceSDK {
  constructor(
    private readonly commerce: CommerceService,
    private readonly shops: ShopRepository,
    private readonly shopItems: ShopItemRepository,
    private readonly orders: OrderRepository,
    private readonly receipts: ReceiptRepository,
    private readonly taxRules: TaxRuleRepository,
  ) {}

  // ── Shops ──────────────────────────────────────────────────────────────────

  async createShop(params: CreateShopParams): Promise<AtcShop> {
    return this.shops.create(params)
  }

  async getShop(shopId: string): Promise<AtcShop | null> {
    return this.shops.findById(shopId)
  }

  async listShops(filter?: ListShopsParams): Promise<ShopPage> {
    return this.shops.list(filter)
  }

  async setShopStatus(shopId: string, status: ShopStatus): Promise<AtcShop | null> {
    return this.shops.updateStatus(shopId, status)
  }

  // ── Shop Items ─────────────────────────────────────────────────────────────

  async upsertShopItem(params: UpsertShopItemParams): Promise<AtcShopItem> {
    return this.shopItems.upsert(params)
  }

  async removeShopItem(shopId: string, itemId: string): Promise<boolean> {
    return this.shopItems.remove(shopId, itemId)
  }

  async getShopInventory(shopId: string): Promise<AtcShopItem[]> {
    return this.shopItems.listByShop(shopId)
  }

  async getShopItem(shopId: string, itemId: string): Promise<AtcShopItem | null> {
    return this.shopItems.findByShopAndItem(shopId, itemId)
  }

  // ── Commerce Transactions ──────────────────────────────────────────────────

  async purchase(params: PurchaseParams): Promise<AtcCommerceTransaction> {
    return this.commerce.purchase(params)
  }

  async sell(params: SellParams): Promise<AtcCommerceTransaction> {
    return this.commerce.sell(params)
  }

  async previewPurchase(shopId: string, itemId: string, quantity: number): Promise<CommerceTotals> {
    return this.commerce.calculateTotals(shopId, itemId, quantity, 'purchase')
  }

  async previewSell(shopId: string, itemId: string, quantity: number): Promise<CommerceTotals> {
    return this.commerce.calculateTotals(shopId, itemId, quantity, 'sell')
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  async getOrder(orderId: string): Promise<AtcCommerceOrder | null> {
    return this.orders.findById(orderId)
  }

  async listOrders(params?: ListOrdersParams): Promise<AtcCommerceOrderPage> {
    return this.orders.list(params)
  }

  // ── Receipts ───────────────────────────────────────────────────────────────

  async getReceipt(receiptId: string): Promise<AtcCommerceReceipt | null> {
    return this.receipts.findById(receiptId)
  }

  async getReceiptByOrder(orderId: string): Promise<AtcCommerceReceipt | null> {
    return this.receipts.findByOrderId(orderId)
  }

  async listReceipts(params?: ListReceiptsParams): Promise<AtcCommerceReceiptPage> {
    return this.receipts.list(params)
  }

  // ── Tax Rules ──────────────────────────────────────────────────────────────

  async createTaxRule(params: CreateTaxRuleParams): Promise<AtcTaxRule> {
    return this.taxRules.create(params)
  }

  async getTaxRule(id: string): Promise<AtcTaxRule | null> {
    return this.taxRules.findById(id)
  }

  async listTaxRules(): Promise<AtcTaxRule[]> {
    return this.taxRules.list()
  }

  async setTaxRuleActive(id: string, isActive: boolean): Promise<boolean> {
    return this.taxRules.setActive(id, isActive)
  }
}
