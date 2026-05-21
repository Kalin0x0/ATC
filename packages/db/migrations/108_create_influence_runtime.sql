CREATE TABLE IF NOT EXISTS atc_influence_runtime (
  id               VARCHAR(26)    NOT NULL,
  faction_id       VARCHAR(26)    NOT NULL,
  territory_id     VARCHAR(26)    NOT NULL,
  influence_score  INT            NOT NULL DEFAULT 0,
  influence_delta  INT            NOT NULL DEFAULT 0,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decay_rate       DECIMAL(5,4)   NOT NULL DEFAULT 0.0100,
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_influence_faction_territory (faction_id, territory_id),
  INDEX idx_influence_territory (territory_id),
  INDEX idx_influence_score (influence_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
