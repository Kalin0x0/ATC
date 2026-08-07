import type { DbPool } from './client.js'
import { generateId } from './id.js'

/**
 * Starting content for a fresh database.
 *
 * Separate from migrations on purpose: migrations describe the shape of the
 * database and must run everywhere, seeds describe its contents and are a
 * choice. Run with `pnpm db:seed`.
 *
 * Everything here is idempotent, so running it against a populated database
 * updates the rows it owns and leaves everything else alone.
 *
 * ## What is here and why
 *
 * Only what committed code already refers to by name, so that those features
 * work rather than 404. Nothing else is invented:
 *
 * - The four `drug_*` recipes named in plugins/atc-criminal/server/init.lua.
 *   Without them the drug-crafting handler resolves a recipe id that does not
 *   exist and the craft fails, which is not a useful default.
 * - The items those recipes consume and produce, because a recipe whose
 *   ingredients are not in atc_item_definitions cannot be crafted either.
 *
 * The quantities and weights are a starting point, not a balance decision.
 * Edit them, or replace this file wholesale — nothing depends on the numbers.
 */

interface SeedItem {
  id: string
  label: string
  description: string
  category: string
  stackable: boolean
  maxStack: number
  weightGrams: number
}

interface SeedRecipe {
  recipeId: string
  recipeName: string
  outputItemId: string
  outputQuantity: number
  recipeType: 'basic' | 'advanced' | 'industrial'
  craftingTimeSeconds: number
  ingredients: ReadonlyArray<{ itemId: string; quantity: number }>
}

const ITEMS: ReadonlyArray<SeedItem> = [
  // Precursors.
  { id: 'cannabis_leaf',   label: 'Cannabis Leaf',   description: 'Unprocessed plant matter.',        category: 'narcotics_precursor', stackable: true, maxStack: 100, weightGrams: 5 },
  { id: 'coca_leaf',       label: 'Coca Leaf',       description: 'Unprocessed plant matter.',        category: 'narcotics_precursor', stackable: true, maxStack: 100, weightGrams: 5 },
  { id: 'pseudoephedrine', label: 'Pseudoephedrine', description: 'Pharmacy precursor.',              category: 'narcotics_precursor', stackable: true, maxStack: 50,  weightGrams: 10 },
  { id: 'opium_resin',     label: 'Opium Resin',     description: 'Raw resin.',                       category: 'narcotics_precursor', stackable: true, maxStack: 50,  weightGrams: 20 },
  { id: 'solvent',         label: 'Chemical Solvent', description: 'Used to process precursors.',     category: 'chemical',            stackable: true, maxStack: 50,  weightGrams: 500 },
  { id: 'packaging',       label: 'Packaging',       description: 'Bags and wraps.',                  category: 'material',            stackable: true, maxStack: 200, weightGrams: 2 },

  // Products. These are what the four drug_* recipes produce.
  { id: 'weed_packaged',   label: 'Packaged Weed',   description: 'Ready for sale.',                  category: 'narcotics',           stackable: true, maxStack: 50,  weightGrams: 10 },
  { id: 'cocaine',         label: 'Cocaine',         description: 'Ready for sale.',                  category: 'narcotics',           stackable: true, maxStack: 50,  weightGrams: 10 },
  { id: 'meth',            label: 'Methamphetamine', description: 'Ready for sale.',                  category: 'narcotics',           stackable: true, maxStack: 50,  weightGrams: 10 },
  { id: 'heroin',          label: 'Heroin',          description: 'Ready for sale.',                  category: 'narcotics',           stackable: true, maxStack: 50,  weightGrams: 10 },
]

const RECIPES: ReadonlyArray<SeedRecipe> = [
  {
    recipeId: 'drug_weed', recipeName: 'Package Weed', outputItemId: 'weed_packaged',
    outputQuantity: 1, recipeType: 'basic', craftingTimeSeconds: 30,
    ingredients: [{ itemId: 'cannabis_leaf', quantity: 5 }, { itemId: 'packaging', quantity: 1 }],
  },
  {
    recipeId: 'drug_coke', recipeName: 'Process Cocaine', outputItemId: 'cocaine',
    outputQuantity: 1, recipeType: 'advanced', craftingTimeSeconds: 60,
    ingredients: [{ itemId: 'coca_leaf', quantity: 8 }, { itemId: 'solvent', quantity: 1 }, { itemId: 'packaging', quantity: 1 }],
  },
  {
    recipeId: 'drug_meth', recipeName: 'Cook Methamphetamine', outputItemId: 'meth',
    outputQuantity: 2, recipeType: 'advanced', craftingTimeSeconds: 90,
    ingredients: [{ itemId: 'pseudoephedrine', quantity: 4 }, { itemId: 'solvent', quantity: 2 }, { itemId: 'packaging', quantity: 1 }],
  },
  {
    recipeId: 'drug_heroin', recipeName: 'Refine Heroin', outputItemId: 'heroin',
    outputQuantity: 1, recipeType: 'advanced', craftingTimeSeconds: 120,
    ingredients: [{ itemId: 'opium_resin', quantity: 3 }, { itemId: 'solvent', quantity: 2 }, { itemId: 'packaging', quantity: 1 }],
  },
]

export interface SeedResult {
  items: number
  recipes: number
  ingredients: number
}

export async function runSeed(pool: DbPool): Promise<SeedResult> {
  const conn = await pool.getConnection()
  try {
    for (const item of ITEMS) {
      await conn.query(
        `INSERT INTO atc_item_definitions
           (id, label, description, category, stackable, max_stack, weight_grams, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
           label = VALUES(label),
           description = VALUES(description),
           category = VALUES(category),
           stackable = VALUES(stackable),
           max_stack = VALUES(max_stack),
           weight_grams = VALUES(weight_grams)`,
        [item.id, item.label, item.description, item.category,
         item.stackable ? 1 : 0, item.maxStack, item.weightGrams],
      )
    }

    let ingredients = 0
    for (const r of RECIPES) {
      await conn.query(
        `INSERT INTO atc_crafting_recipes
           (id, recipe_id, recipe_name, output_item_id, output_quantity, recipe_type,
            required_station, crafting_time_seconds, is_discoverable, is_active)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 1, 1)
         ON DUPLICATE KEY UPDATE
           recipe_name = VALUES(recipe_name),
           output_item_id = VALUES(output_item_id),
           output_quantity = VALUES(output_quantity),
           recipe_type = VALUES(recipe_type),
           crafting_time_seconds = VALUES(crafting_time_seconds)`,
        [generateId(), r.recipeId, r.recipeName, r.outputItemId,
         r.outputQuantity, r.recipeType, r.craftingTimeSeconds],
      )

      // Replaced rather than merged, so a recipe's cost is whatever this file
      // says it is — an ingredient removed here disappears rather than lingers.
      await conn.query('DELETE FROM atc_crafting_recipe_ingredients WHERE recipe_id = ?', [r.recipeId])
      for (const ing of r.ingredients) {
        await conn.query(
          `INSERT INTO atc_crafting_recipe_ingredients (id, recipe_id, item_id, quantity)
           VALUES (?, ?, ?, ?)`,
          [generateId(), r.recipeId, ing.itemId, ing.quantity],
        )
        ingredients++
      }
    }

    return { items: ITEMS.length, recipes: RECIPES.length, ingredients }
  } finally {
    conn.release()
  }
}
