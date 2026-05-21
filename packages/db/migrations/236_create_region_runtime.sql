CREATE TABLE IF NOT EXISTS atc_region_runtime (
  id              VARCHAR(26)  NOT NULL,
  region_id       VARCHAR(128) NOT NULL,
  region_type     ENUM('primary','secondary','edge','backup','custom') NOT NULL,
  status          ENUM('active','syncing','stale','offline') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  sync_nonce      VARCHAR(128) NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  region_data     JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_region_runtime_region_id (region_id),
  KEY idx_region_runtime_status (status),
  KEY idx_region_runtime_active (is_active),
  KEY idx_region_runtime_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
