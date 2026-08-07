import type { AtcEventBus } from '@atc/events'
import type { CraftingRecipeService } from './crafting-recipe.service.js'
import type { AtcRecipeIngredient } from './crafting-recipe.repository.js'
import {
  RecipeNotFoundError,
  RecipeInactiveError,
  RecipeHasNoIngredientsError,
  RecipeRequiresStationError,
  InsufficientMaterialsError,
  CraftCompensationFailedError,
  CraftNonceConsumedError,
} from './errors.js'

/**
 * The slice of the inventory repository a craft needs.
 *
 * Declared here as a port rather than imported: this package does not depend on
 * @atc/db, and a craft only ever reads a character's items and moves them in
 * and out. @atc/db's InventoryRepository satisfies it structurally.
 */
export interface CraftInventoryPort {
  getByCharacter(characterId: string): Promise<{ slots: ReadonlyArray<{ itemId: string; quantity: number }> }>
  /** Null when nothing has been written under this key. */
  findTransactionByIdempotencyKey(key: string): Promise<unknown | null>
  /** Whether any key beginning with this prefix has been used. */
  hasTransactionWithPrefix(prefix: string): Promise<boolean>
  addItem(params: {
    characterId: string
    itemId: string
    quantity: number
    reason: string
    source: 'gameplay'
    idempotencyKey: string
  }): Promise<unknown>
  removeItem(params: {
    characterId: string
    itemId: string
    quantity: number
    reason: string
    source: 'gameplay'
    idempotencyKey: string
  }): Promise<unknown>
}

export interface CraftParams {
  characterId: string
  recipeId: string
  /**
   * Caller-supplied, stable per craft attempt. Every inventory mutation the
   * craft makes derives its idempotency key from this, so retrying a request
   * whose response was lost replays the same craft instead of charging twice.
   */
  craftNonce: string
}

export interface CraftResult {
  recipeId: string
  characterId: string
  outputItemId: string
  outputQuantity: number
  consumed: ReadonlyArray<{ itemId: string; quantity: number }>
  /** True when this nonce had already been crafted and the stored result was returned. */
  idempotent: boolean
}

/**
 * Instant crafting: consume a recipe's ingredients from a character's inventory
 * and grant its output.
 *
 * Distinct from the production-job flow in this package. That models industrial
 * manufacturing — a registered station, a queue, a timed job settled by a
 * separate call — and never touches character inventory. This is the character
 * action: immediate, from what they are carrying.
 *
 * ## Atomicity
 *
 * A craft is several inventory mutations, and the inventory repository opens a
 * transaction per mutation — it does not accept an outer one. So a craft is a
 * saga, not a transaction, and it is worth being exact about what that means:
 *
 * - Every step is idempotent on a key derived from craftNonce, so a retry of
 *   the whole craft never double-charges or double-grants.
 * - A retry of a craft that succeeded returns the same result rather than
 *   crafting again. Note that the per-step idempotency is not enough for this
 *   on its own: the material check at the top would fail against the inventory
 *   the first run left behind, and the caller would be told the craft failed
 *   when it had in fact succeeded. So the nonce is checked before anything else.
 * - If a step fails, the steps already applied are compensated — the ingredients
 *   taken so far are put back. That nonce is then spent: retrying under it would
 *   replay the removals as recorded no-ops while granting the output for real,
 *   so it is refused with CraftNonceConsumedError and a new one is required.
 * - If compensation itself fails, the caller gets CraftCompensationFailedError
 *   naming exactly what was not returned. That case is not silently swallowed,
 *   because it is the only one where a character ends up out of pocket.
 */
export class CraftService {
  constructor(
    private readonly recipes: CraftingRecipeService,
    private readonly inventory: CraftInventoryPort,
    private readonly eventBus?: AtcEventBus,
  ) {}

  async craft(params: CraftParams): Promise<CraftResult> {
    const { characterId, recipeId, craftNonce } = params

    const recipe = await this.recipes.getRecipeWithIngredients(recipeId)
    if (!recipe) throw new RecipeNotFoundError(recipeId)
    if (!recipe.isActive) throw new RecipeInactiveError(recipeId)
    if (recipe.requiredStation !== null) {
      throw new RecipeRequiresStationError(recipeId, recipe.requiredStation)
    }
    if (recipe.ingredients.length === 0) throw new RecipeHasNoIngredientsError(recipeId)

    // ── What has this nonce already done? ─────────────────────────────────────
    // Before the material check, not after: after one successful craft the
    // character no longer holds the ingredients, so a retry would fail that
    // check and report "not enough materials" for a craft that had succeeded.
    if (await this.inventory.findTransactionByIdempotencyKey(`${craftNonce}:out`)) {
      return {
        recipeId,
        characterId,
        outputItemId: recipe.outputItemId,
        outputQuantity: recipe.outputQuantity,
        consumed: recipe.ingredients.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
        idempotent: true,
      }
    }
    // No output, but the nonce has been used: an earlier attempt took the
    // ingredients and gave them back. Its removals are recorded, so replaying
    // them would move nothing while the grant would be real.
    if (await this.inventory.hasTransactionWithPrefix(`${craftNonce}:`)) {
      throw new CraftNonceConsumedError(craftNonce)
    }

    // ── Check before taking anything ──────────────────────────────────────────
    // Stacks of the same item can sit in several slots, so held quantity is the
    // sum across slots, not the largest one.
    const inv = await this.inventory.getByCharacter(characterId)
    const held = new Map<string, number>()
    for (const slot of inv.slots) {
      held.set(slot.itemId, (held.get(slot.itemId) ?? 0) + slot.quantity)
    }

    const missing = recipe.ingredients
      .map((ing) => ({ itemId: ing.itemId, required: ing.quantity, heldQty: held.get(ing.itemId) ?? 0 }))
      .filter((x) => x.heldQty < x.required)
      .map((x) => ({ itemId: x.itemId, required: x.required, held: x.heldQty }))

    if (missing.length > 0) throw new InsufficientMaterialsError(recipeId, missing)

    // ── Consume ───────────────────────────────────────────────────────────────
    const consumed: { itemId: string; quantity: number }[] = []
    for (const ing of recipe.ingredients) {
      try {
        await this.inventory.removeItem({
          characterId,
          itemId: ing.itemId,
          quantity: ing.quantity,
          reason: `craft:${recipeId}`,
          source: 'gameplay',
          idempotencyKey: `${craftNonce}:in:${ing.itemId}`,
        })
        consumed.push({ itemId: ing.itemId, quantity: ing.quantity })
      } catch (err) {
        // Between the check above and here, something else could have taken the
        // item — another craft, a trade, a drop. Put back whatever this craft
        // already took and fail.
        await this._compensate(characterId, recipeId, craftNonce, consumed)
        throw err
      }
    }

    // ── Grant ─────────────────────────────────────────────────────────────────
    try {
      await this.inventory.addItem({
        characterId,
        itemId: recipe.outputItemId,
        quantity: recipe.outputQuantity,
        reason: `craft:${recipeId}`,
        source: 'gameplay',
        idempotencyKey: `${craftNonce}:out`,
      })
    } catch (err) {
      // Typically a full inventory: the ingredients are gone but the output does
      // not fit. Returning them leaves the character exactly as they were.
      await this._compensate(characterId, recipeId, craftNonce, consumed)
      throw err
    }

    this.eventBus?.emit('atc:crafting:item:crafted', {
      characterId,
      recipeId,
      outputItemId: recipe.outputItemId,
      outputQuantity: recipe.outputQuantity,
    }).catch(() => undefined)

    return {
      recipeId,
      characterId,
      outputItemId: recipe.outputItemId,
      outputQuantity: recipe.outputQuantity,
      consumed,
      idempotent: false,
    }
  }

  /**
   * Return ingredients a failed craft already took.
   *
   * Keyed off craftNonce like the forward path, so a retried craft does not
   * compensate twice. Every return is attempted even if one fails, so a single
   * bad item does not strand the rest.
   */
  private async _compensate(
    characterId: string,
    recipeId: string,
    craftNonce: string,
    consumed: ReadonlyArray<{ itemId: string; quantity: number }>,
  ): Promise<void> {
    if (consumed.length === 0) return

    const unreturned: { itemId: string; quantity: number }[] = []
    for (const item of consumed) {
      try {
        await this.inventory.addItem({
          characterId,
          itemId: item.itemId,
          quantity: item.quantity,
          reason: `craft:${recipeId}:rollback`,
          source: 'gameplay',
          idempotencyKey: `${craftNonce}:rb:${item.itemId}`,
        })
      } catch {
        unreturned.push(item)
      }
    }

    if (unreturned.length > 0) {
      throw new CraftCompensationFailedError(recipeId, characterId, craftNonce, unreturned)
    }
  }
}

export type { AtcRecipeIngredient }
