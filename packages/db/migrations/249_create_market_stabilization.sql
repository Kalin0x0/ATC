CREATE TABLE IF NOT EXISTS atc_market_stabilization (
  id                  VARCHAR(26)  NOT NULL,
  stabilization_id    VARCHAR(26)  NOT NULL,
  market_type         ENUM('goods','services','real_estate','labor','financial','custom') NOT NULL,
  status              ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  stabilization_nonce VARCHAR(128) NOT NULL,
  region_id           VARCHAR(128) NULL,
  stabilization_data  JSON         NOT NULL,
  completed_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_market_stabilization_id (stabilization_id),
  UNIQUE KEY uq_market_stabilization_nonce (stabilization_nonce, owner_server_id),
  KEY idx_market_stabilization_status (status),
  KEY idx_market_stabilization_region (region_id),
  KEY idx_market_stabilization_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
