CREATE TABLE IF NOT EXISTS atc_supply_chain_runtime (
  id           VARCHAR(26)   NOT NULL,
  chain_id     VARCHAR(128)  NOT NULL,
  chain_name   VARCHAR(256)  NOT NULL,
  nodes        TEXT          NOT NULL DEFAULT '[]',
  edges        TEXT          NOT NULL DEFAULT '[]',
  status       VARCHAR(32)   NOT NULL DEFAULT 'active',
  last_tick_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chain_id (chain_id),
  INDEX idx_chain_status (status),
  INDEX idx_chain_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
