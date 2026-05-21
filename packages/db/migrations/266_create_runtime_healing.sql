CREATE TABLE IF NOT EXISTS atc_runtime_healing (
  id               VARCHAR(26)  NOT NULL,
  healing_id       VARCHAR(26)  NOT NULL,
  healing_type     ENUM('restart','failover','rollback','rebalance','patch','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_node      VARCHAR(128) NOT NULL,
  healing_nonce    VARCHAR(128) NOT NULL,
  healing_data     JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_healing_id (healing_id),
  UNIQUE KEY uq_healing_nonce (healing_nonce, owner_server_id),
  KEY idx_healing_status (status),
  KEY idx_healing_target (target_node),
  KEY idx_healing_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
