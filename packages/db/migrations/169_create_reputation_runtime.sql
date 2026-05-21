CREATE TABLE IF NOT EXISTS atc_reputation_runtime (
  id               VARCHAR(26)   NOT NULL,
  principal_id     VARCHAR(128)  NOT NULL,
  faction_id       VARCHAR(128)  NOT NULL,
  reputation_score DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tier             VARCHAR(32)   NOT NULL DEFAULT 'neutral',
  last_change_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reputation_principal_faction (principal_id, faction_id),
  KEY idx_reputation_principal (principal_id),
  KEY idx_reputation_faction (faction_id),
  KEY idx_reputation_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
