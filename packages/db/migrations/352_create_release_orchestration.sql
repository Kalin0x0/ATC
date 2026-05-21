CREATE TABLE IF NOT EXISTS atc_release_orchestration (
  id                  CHAR(26)     NOT NULL,
  orchestration_id    VARCHAR(128) NOT NULL,
  orchestration_type  VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id     VARCHAR(128) NOT NULL,
  orchestration_data  JSON         NULL,
  synced_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_release_orchestration_id (orchestration_id),
  INDEX idx_release_orchestration_status (status),
  INDEX idx_release_orchestration_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
