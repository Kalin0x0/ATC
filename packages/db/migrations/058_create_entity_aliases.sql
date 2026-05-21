-- Phase 27 — Entity Aliases: alternate identifiers / names / external IDs
-- Append-safe alias log. Aliases are case-folded for index lookups via a
-- generated lowercase column (MariaDB 10.6+ / MySQL 8.0+).
CREATE TABLE IF NOT EXISTS atc_entity_aliases (
  id              CHAR(26)     NOT NULL,
  entity_id       CHAR(26)     NOT NULL,
  alias_kind      VARCHAR(32)  NOT NULL,
  alias_value     VARCHAR(255) NOT NULL,
  alias_value_lc  VARCHAR(255) GENERATED ALWAYS AS (LOWER(alias_value)) STORED,
  source_system   VARCHAR(64)  NOT NULL,
  created_by      VARCHAR(128) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_alias_entity_kind_value (entity_id, alias_kind, alias_value),
  KEY idx_alias_value_lc    (alias_value_lc),
  KEY idx_alias_entity      (entity_id),
  KEY idx_alias_kind        (alias_kind),
  KEY idx_alias_created     (created_at),
  CONSTRAINT chk_alias_kind CHECK (
    alias_kind IN ('name','nickname','phone','plate','email','external_id','badge','vin','tag')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
