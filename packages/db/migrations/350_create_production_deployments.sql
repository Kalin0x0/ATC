CREATE TABLE IF NOT EXISTS atc_production_deployments (
  id               CHAR(26)     NOT NULL,
  deployment_id    VARCHAR(128) NOT NULL,
  deployment_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  deployment_data  JSON         NULL,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_deployment_id (deployment_id),
  INDEX idx_production_deployment_status (status),
  INDEX idx_production_deployment_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
