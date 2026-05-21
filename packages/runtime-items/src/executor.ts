import { InventoryItemNotFoundError, InventoryInsufficientQuantityError } from '@atc/db'
import type { InventoryRepository, ItemDefinitionRepository } from '@atc/db'
import type { AtcItemUseRequest, AtcItemUseResponse, AtcItemEffectResult } from '@atc/shared-types'
import { ItemCooldownCache } from './cooldown-cache.js'
import { RuntimeEffectRegistry } from './effect-registry.js'
import { validateItemForUse } from './validation-pipeline.js'

// ── Custom errors ─────────────────────────────────────────────────────────────

export class ItemNotUsableError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors[0] ?? 'Item is not usable')
    this.name = 'ItemNotUsableError'
  }
}

export class ItemCooldownActiveError extends Error {
  constructor(public readonly expiresAt: Date) {
    super(`Item is on cooldown until ${expiresAt.toISOString()}`)
    this.name = 'ItemCooldownActiveError'
  }
}

export class ItemInsufficientDurabilityError extends Error {
  constructor(message = 'Item has no remaining durability') {
    super(message)
    this.name = 'ItemInsufficientDurabilityError'
  }
}

// ── Executor ──────────────────────────────────────────────────────────────────

export class ItemRuntimeExecutor {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly itemDefinitions: ItemDefinitionRepository,
    private readonly cooldown: ItemCooldownCache,
    private readonly effects: RuntimeEffectRegistry = new RuntimeEffectRegistry(),
  ) {}

  async useItem(characterId: string, request: AtcItemUseRequest): Promise<AtcItemUseResponse> {
    const { slot, idempotencyKey } = request

    // 1. Fetch the slot (includes durability, equipped, lastUsedAt from Phase 8)
    const slotData = await this.inventory.getSlot(characterId, slot)
    if (!slotData) {
      throw new InventoryItemNotFoundError(`No item in slot ${slot} for character ${characterId}`)
    }

    // 2. Fetch item definition
    const itemDef = await this.itemDefinitions.findById(slotData.itemId)
    if (!itemDef) {
      throw new InventoryItemNotFoundError(`Item definition '${slotData.itemId}' not found`)
    }

    // 3. Validate usability (status, usable flag, action config)
    const actionConfig = itemDef.actionConfig
    const validation = validateItemForUse(itemDef, actionConfig)
    if (!validation.valid) {
      throw new ItemNotUsableError(validation.errors)
    }

    const cfg = actionConfig!
    const consumeQuantity = cfg.consumeQuantity ?? 1
    const destroyOnEmpty = cfg.destroyOnEmpty ?? false

    // 4. Check cooldown in Redis
    const existingCooldown = await this.cooldown.get(characterId, slot)
    if (existingCooldown) {
      throw new ItemCooldownActiveError(existingCooldown.expiresAt)
    }

    // 5. Durability pre-check (fast path before DB transaction)
    //    Only enforce if durabilityCost > 0 AND the slot tracks durability (durability !== null).
    //    Check mirrors executeUse: durability < cost (covers both durability=0 and partial cases).
    const durabilityCost =
      (cfg.durabilityCost ?? 0) > 0 && slotData.durability !== null
        ? (cfg.durabilityCost ?? 0)
        : 0

    if (durabilityCost > 0 && slotData.durability !== null && slotData.durability < durabilityCost) {
      throw new ItemInsufficientDurabilityError()
    }

    // 6. Execute atomic DB use (slot lock + quantity decrement + durability + log)
    const useResult = await this.inventory.executeUse({
      characterId,
      slot,
      consumeQuantity,
      durabilityCost,
      destroyOnEmpty,
      idempotencyKey,
    })

    // Idempotent replay — return cached result without re-applying cooldown or effects
    if (useResult.idempotent) {
      return {
        success: true,
        itemId: slotData.itemId,
        slot,
        consumed: useResult.consumed,
        remainingQuantity: useResult.remainingQuantity,
        durability: useResult.durability,
        cooldownExpiresAt: null,
        effects: [],
        idempotent: true,
      }
    }

    // 7. Set cooldown in Redis (after successful DB write)
    let cooldownExpiresAt: Date | null = null
    if (cfg.cooldownMs && cfg.cooldownMs > 0) {
      cooldownExpiresAt = await this.cooldown.set(characterId, slot, cfg.cooldownMs)
    }

    // 8. Execute registered effects
    const effectResults: AtcItemEffectResult[] = []

    // Legacy single serverEvent (custom plugin handler)
    if ((cfg.type === 'consume' || cfg.type === 'custom_event') && cfg.serverEvent) {
      const result = await this.effects.execute(cfg.serverEvent, characterId, slotData.itemId)
      effectResults.push({ type: cfg.serverEvent, success: result.success, ...(result.data ? { data: result.data } : {}) })
    }

    // Typed built-in effects array (Phase 9+: vitals.modify, etc.)
    if (cfg.effects && cfg.effects.length > 0) {
      for (const effectCfg of cfg.effects) {
        const result = await this.effects.execute(
          effectCfg.type,
          characterId,
          slotData.itemId,
          effectCfg as unknown as Record<string, unknown>,
        )
        effectResults.push({ type: effectCfg.type, success: result.success, ...(result.data ? { data: result.data } : {}) })
      }
    }

    return {
      success: true,
      itemId: slotData.itemId,
      slot,
      consumed: useResult.consumed,
      remainingQuantity: useResult.remainingQuantity,
      durability: useResult.durability,
      cooldownExpiresAt,
      effects: effectResults,
      idempotent: false,
    }
  }

  getEffectRegistry(): RuntimeEffectRegistry {
    return this.effects
  }
}
