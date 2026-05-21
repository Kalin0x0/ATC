CREATE TABLE IF NOT EXISTS atc_adaptive_optimization (
  id                VARCHAR(26)  NOT NULL,
  optimization_id   VARCHAR(26)  NOT NULL,
  optimization_type ENUM('cpu','memory','latency','throughput','concurrency','custom') NOT NULL,
  status            ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  target_node       VARCHAR(128) NOT NULL,
  optimization_nonce VARCHAR(128) NOT NULL,
  optimization_data  JSON        NOT NULL,
  completed_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_optimization_id (optimization_id),
  UNIQUE KEY uq_optimization_nonce (optimization_nonce, owner_server_id),
  KEY idx_optimization_status (status),
  KEY idx_optimization_owner (owner_server_id),
  KEY idx_optimization_node (target_node)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
