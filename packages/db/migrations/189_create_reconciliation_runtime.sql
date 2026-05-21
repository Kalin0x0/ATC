CREATE TABLE IF NOT EXISTS atc_reconciliation_runtime (
  id                  VARCHAR(26)   NOT NULL,
  reconciliation_id   VARCHAR(26)   NOT NULL,
  region_id           VARCHAR(128)  NULL,
  server_id           VARCHAR(128)  NULL,
  reconciliation_type VARCHAR(64)   NOT NULL,
  status              VARCHAR(32)   NOT NULL DEFAULT 'running',
  issues_found        INT           NOT NULL DEFAULT 0,
  issues_resolved     INT           NOT NULL DEFAULT 0,
  last_run_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_reconciliation_id (reconciliation_id),
  KEY idx_reconciliation_status (status),
  KEY idx_reconciliation_region (region_id),
  KEY idx_reconciliation_server (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
