CREATE TABLE IF NOT EXISTS atc_global_ownership (
  id               CHAR(26)     NOT NULL,
  resource_id      VARCHAR(128) NOT NULL,
  ownership_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'claimed',
  owner_server_id  VARCHAR(128) NOT NULL,
  ownership_data   JSON         NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_ownership_resource_id (resource_id),
  INDEX idx_global_ownership_status (status),
  INDEX idx_global_ownership_owner (owner_server_id),
  INDEX idx_global_ownership_type (ownership_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
