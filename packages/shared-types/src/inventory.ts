export type AtcItemDefinitionStatus = 'active' | 'disabled' | 'deprecated'
export type AtcInventoryTransactionType = 'add' | 'remove' | 'move' | 'set' | 'use'
export type AtcInventoryTransactionSource = 'system' | 'admin' | 'api' | 'gameplay'

// ── Phase 8: Item runtime types ───────────────────────────────────────────────

export type AtcItemActionType = 'consume' | 'cooldown_only' | 'custom_event'

// ── Phase 9: Typed built-in effects ──────────────────────────────────────────

export interface AtcItemEffectConfig {
  type: 'vitals.modify'
  vital: import('./vitals.js').AtcVitalName
  mode: import('./vitals.js').AtcVitalsMutationMode
  amount: number
}

export interface AtcItemActionConfig {
  type: AtcItemActionType
  cooldownMs?: number
  consumeQuantity?: number
  durabilityCost?: number
  destroyOnEmpty?: boolean
  serverEvent?: string
  effects?: AtcItemEffectConfig[]
}

export interface AtcItemUseRequest {
  slot: number
  idempotencyKey: string
}

export interface AtcItemEffectResult {
  type: string
  success: boolean
  data?: Record<string, unknown>
}

export interface AtcItemUseResponse {
  success: boolean
  itemId: string
  slot: number
  consumed: number
  remainingQuantity: number
  durability: number | null
  cooldownExpiresAt: Date | null
  effects: AtcItemEffectResult[]
  idempotent: boolean
}

export interface AtcItemCooldown {
  characterId: string
  slot: number
  expiresAt: Date
}

export interface AtcItemRuntimeValidationResult {
  valid: boolean
  errors: string[]
}

export interface AtcItemDefinition {
  id: string
  label: string
  description: string | null
  category: string
  stackable: boolean
  maxStack: number
  weightGrams: number
  usable: boolean
  tradable: boolean
  metadataSchema: Record<string, unknown> | null
  status: AtcItemDefinitionStatus
  imageUrl: string | null
  icon: string | null
  tags: string[]
  sortOrder: number
  version: number
  actionConfig: AtcItemActionConfig | null
  createdAt: Date
  updatedAt: Date
}

// ── Phase 7: Item catalog management types ────────────────────────────────────

export interface AtcItemDefinitionCreateRequest {
  id: string
  label: string
  description?: string
  category: string
  stackable?: boolean
  maxStack?: number
  weightGrams?: number
  usable?: boolean
  tradable?: boolean
  metadataSchema?: Record<string, unknown>
  status?: AtcItemDefinitionStatus
  imageUrl?: string
  icon?: string
  tags?: string[]
  sortOrder?: number
}

export interface AtcItemDefinitionUpdateRequest {
  label?: string
  description?: string | null
  category?: string
  stackable?: boolean
  maxStack?: number
  weightGrams?: number
  usable?: boolean
  tradable?: boolean
  metadataSchema?: Record<string, unknown> | null
  imageUrl?: string | null
  icon?: string | null
  tags?: string[]
  sortOrder?: number
}

export interface AtcItemDefinitionBulkUpsertRequest {
  items: AtcItemDefinitionCreateRequest[]
}

export interface AtcItemDefinitionBulkUpsertResponse {
  upserted: number
  items: AtcItemDefinition[]
}

export interface AtcItemMetadataValidationRequest {
  metadataSchema: Record<string, unknown>
  sampleMetadata?: Record<string, unknown>
}

export interface AtcItemMetadataValidationResponse {
  valid: boolean
  errors: string[]
}

export interface AtcItemCatalogQuery {
  category?: string
  status?: AtcItemDefinitionStatus
  tag?: string
  search?: string
  limit?: number
  offset?: number
}

// ── Inventory slot + transaction types ────────────────────────────────────────

export interface AtcInventorySlot {
  id: string
  characterId: string
  itemId: string
  slot: number
  quantity: number
  metadata: Record<string, unknown> | null
  durability: number | null
  equipped: boolean
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcInventoryTransaction {
  id: string
  characterId: string
  type: AtcInventoryTransactionType
  itemId: string | null
  slotFrom: number | null
  slotTo: number | null
  quantity: number | null
  reason: string
  source: AtcInventoryTransactionSource
  idempotencyKey: string
  payloadHash: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export interface AtcInventoryWeightSummary {
  totalWeightGrams: number
  maxWeightGrams: number
  isOverweight: boolean
  remainingWeightGrams: number
}

export interface AtcInventorySettings {
  characterId: string
  maxSlots: number
  maxWeightGrams: number
  createdAt: Date
  updatedAt: Date
}

export interface AtcInventoryCapacitySummary {
  usedSlots: number
  maxSlots: number
  freeSlots: number
  isFull: boolean
}

export interface AtcInventoryResponse {
  characterId: string
  slots: AtcInventorySlot[]
  settings: AtcInventorySettings
  weightSummary: AtcInventoryWeightSummary
  capacitySummary: AtcInventoryCapacitySummary
}

export interface AtcInventoryMutationResponse {
  transactionId: string
  characterId: string
  slot: number | null
  itemId: string | null
  quantity: number
  type: AtcInventoryTransactionType
  idempotent: boolean
}

export interface AtcInventoryAddRequest {
  itemId: string
  quantity: number
  slot?: number
  reason: string
  source: AtcInventoryTransactionSource
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface AtcInventoryRemoveRequest {
  itemId: string
  quantity: number
  slot?: number
  reason: string
  source: AtcInventoryTransactionSource
  idempotencyKey: string
}

export interface AtcInventoryMoveRequest {
  fromSlot: number
  toSlot: number
  quantity?: number
  idempotencyKey: string
}

export interface AtcUpsertItemDefinitionRequest {
  id: string
  label: string
  description?: string
  category: string
  stackable?: boolean
  maxStack?: number
  weightGrams?: number
  usable?: boolean
  tradable?: boolean
  metadataSchema?: Record<string, unknown>
  status?: AtcItemDefinitionStatus
}
