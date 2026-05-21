CREATE TABLE IF NOT EXISTS atc_distributed_repair (
  id               VARCHAR(26)  NOT NULL,
  repair_id        VARCHAR(26)  NOT NULL,
  repair_type      ENUM('data_repair','state_sync','schema_fix','consistency_check','index_rebuild','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_node      VARCHAR(128) NOT NULL,
  repair_nonce     VARCHAR(128) NOT NULL,
  repair_data      JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_repair_id (repair_id),
  UNIQUE KEY uq_repair_nonce (repair_nonce, owner_server_id),
  KEY idx_repair_status (status),
  KEY idx_repair_target (target_node),
  KEY idx_repair_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
