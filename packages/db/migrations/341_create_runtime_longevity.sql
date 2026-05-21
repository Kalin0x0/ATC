CREATE TABLE IF NOT EXISTS atc_runtime_longevity (
  id              CHAR(26)     NOT NULL,
  longevity_id    CHAR(26)     NOT NULL,
  longevity_type  VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  longevity_nonce VARCHAR(128) NOT NULL,
  longevity_data  JSON         NULL,
  archived_at     DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_longevity_id (longevity_id),
  UNIQUE KEY uq_runtime_longevity_nonce (longevity_nonce, owner_server_id),
  INDEX idx_runtime_longevity_status (status),
  INDEX idx_runtime_longevity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
