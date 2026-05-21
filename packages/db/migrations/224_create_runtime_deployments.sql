CREATE TABLE IF NOT EXISTS atc_runtime_deployments (
  id               VARCHAR(26)   NOT NULL,
  deployment_id    VARCHAR(128)  NOT NULL,
  deployment_type  VARCHAR(64)   NOT NULL,
  status           VARCHAR(32)   NOT NULL DEFAULT 'pending',
  target_node      VARCHAR(128)  NOT NULL,
  owner_server_id  VARCHAR(128)  NOT NULL,
  deployment_nonce VARCHAR(128)  NOT NULL,
  deployment_data  TEXT          NOT NULL DEFAULT '{}',
  started_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_deployment_nonce (deployment_nonce),
  KEY idx_deployment_status (status),
  KEY idx_deployment_target (target_node),
  KEY idx_deployment_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
