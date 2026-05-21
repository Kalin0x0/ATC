CREATE TABLE IF NOT EXISTS atc_runtime_succession (
  id                CHAR(26)     NOT NULL,
  succession_id     CHAR(26)     NOT NULL,
  succession_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  target_server_id  VARCHAR(128) NULL,
  succession_nonce  VARCHAR(128) NOT NULL,
  succession_data   JSON         NULL,
  transferred_at    DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_succession_id (succession_id),
  UNIQUE KEY uq_runtime_succession_nonce (succession_nonce, owner_server_id),
  INDEX idx_runtime_succession_status (status),
  INDEX idx_runtime_succession_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
