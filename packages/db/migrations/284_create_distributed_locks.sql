CREATE TABLE IF NOT EXISTS atc_distributed_locks (
  id              VARCHAR(26)  NOT NULL,
  resource_key    VARCHAR(255) NOT NULL,
  lock_type       ENUM('exclusive','shared','advisory','intent','custom') NOT NULL,
  status          ENUM('acquired','released','expired','contested') NOT NULL DEFAULT 'acquired',
  owner_server_id VARCHAR(128) NOT NULL,
  lock_nonce      VARCHAR(128) NOT NULL,
  expires_at      DATETIME(3)  NULL,
  lock_data       JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_lock_resource (resource_key),
  KEY idx_lock_status (status),
  KEY idx_lock_owner (owner_server_id),
  KEY idx_lock_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
