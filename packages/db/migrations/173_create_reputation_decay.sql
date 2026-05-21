CREATE TABLE IF NOT EXISTS atc_reputation_decay (
  id              VARCHAR(26)   NOT NULL,
  principal_id    VARCHAR(128)  NOT NULL,
  faction_id      VARCHAR(128)  NULL,
  decay_rate      DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
  next_decay_at   DATETIME(3)   NOT NULL,
  last_decayed_at DATETIME(3)   NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_decay_principal_faction (principal_id, faction_id),
  KEY idx_decay_next_decay (next_decay_at),
  KEY idx_decay_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
