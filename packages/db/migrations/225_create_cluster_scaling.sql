CREATE TABLE IF NOT EXISTS atc_cluster_scaling (
  id              VARCHAR(26)   NOT NULL,
  scaling_id      VARCHAR(128)  NOT NULL,
  scaling_type    VARCHAR(64)   NOT NULL,
  target_count    INT           NOT NULL DEFAULT 1,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128)  NOT NULL,
  scaling_nonce   VARCHAR(128)  NOT NULL,
  scaling_data    TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_scaling_nonce (scaling_nonce),
  KEY idx_scaling_status (status),
  KEY idx_scaling_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
