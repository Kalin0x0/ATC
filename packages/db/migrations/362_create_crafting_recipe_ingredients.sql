-- ---------------------------------------------------------------------------
-- 362_create_crafting_recipe_ingredients.sql
-- ---------------------------------------------------------------------------
-- Phase 98 — What a recipe costs.
--
-- atc_crafting_recipes has only ever described the output (output_item_id,
-- output_quantity) and how long it takes. Nothing recorded the input, so the
-- server could not tell whether a character was able to craft something, and
-- POST /api/v1/crafting/craft could not exist: the ingredient list would have
-- had to come from the client.
--
-- A row per ingredient rather than a JSON column so the cost of a recipe can be
-- queried and joined like any other data.

CREATE TABLE IF NOT EXISTS atc_crafting_recipe_ingredients (
  id         CHAR(26)     NOT NULL,
  -- References atc_crafting_recipes.recipe_id (the stable public id), not its
  -- surrogate id — that is what every other crafting table refers to a recipe by.
  recipe_id  VARCHAR(128) NOT NULL,
  -- References atc_item_definitions.id. Deliberately not a foreign key: recipes
  -- are seeded before the item catalogue in some deployments, and a missing
  -- item surfaces as a failed craft rather than a failed migration.
  item_id    VARCHAR(128) NOT NULL,
  quantity   INT UNSIGNED NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                          ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- One row per item per recipe; a recipe needing two of something says so in
  -- quantity rather than in a second row.
  UNIQUE KEY uq_recipe_ingredient (recipe_id, item_id),
  INDEX idx_recipe_ingredient_recipe (recipe_id),
  CONSTRAINT fk_recipe_ingredient_recipe FOREIGN KEY (recipe_id)
    REFERENCES atc_crafting_recipes (recipe_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
