CREATE TABLE IF NOT EXISTS atc_crafting_blueprints (
  id           VARCHAR(26)   NOT NULL,
  blueprint_id VARCHAR(128)  NOT NULL,
  principal_id VARCHAR(128)  NOT NULL,
  recipe_id    VARCHAR(128)  NOT NULL,
  source       VARCHAR(128)  NOT NULL DEFAULT 'unknown',
  acquired_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_blueprint_id (blueprint_id),
  UNIQUE KEY uq_blueprint_principal_recipe (principal_id, recipe_id),
  INDEX idx_blueprint_principal (principal_id),
  INDEX idx_blueprint_recipe (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
