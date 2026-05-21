CREATE TABLE IF NOT EXISTS atc_sdk_registry (
  id               CHAR(26)     NOT NULL,
  sdk_id           VARCHAR(128) NOT NULL,
  sdk_type         VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  sdk_data         JSON         NULL,
  registered_at    DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sdk_registry_id (sdk_id),
  INDEX idx_sdk_registry_status (status),
  INDEX idx_sdk_registry_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
