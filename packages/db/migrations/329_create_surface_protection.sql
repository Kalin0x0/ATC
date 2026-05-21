CREATE TABLE IF NOT EXISTS atc_surface_protection (
  id               CHAR(26)     NOT NULL,
  protection_id    CHAR(26)     NOT NULL,
  protection_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  protection_nonce VARCHAR(128) NOT NULL,
  protection_data  JSON         NULL,
  activated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_surface_protection_id (protection_id),
  UNIQUE KEY uq_surface_protection_nonce (protection_nonce, owner_server_id),
  INDEX idx_surface_protection_status (status),
  INDEX idx_surface_protection_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
