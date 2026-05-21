CREATE TABLE IF NOT EXISTS atc_plugin_compatibility (
  id                   CHAR(26)     NOT NULL,
  compatibility_id     CHAR(26)     NOT NULL,
  compatibility_type   VARCHAR(32)  NOT NULL,
  status               VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id      VARCHAR(128) NOT NULL,
  compatibility_nonce  VARCHAR(128) NOT NULL,
  compatibility_data   JSON         NULL,
  validated_at         DATETIME(3)  NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_plugin_compatibility_id (compatibility_id),
  UNIQUE KEY uq_plugin_compatibility_nonce (compatibility_nonce, owner_server_id),
  INDEX idx_plugin_compatibility_status (status),
  INDEX idx_plugin_compatibility_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
