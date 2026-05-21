CREATE TABLE IF NOT EXISTS atc_runtime_handshakes (
  id               VARCHAR(26)  NOT NULL,
  handshake_id     VARCHAR(26)  NOT NULL,
  handshake_type   ENUM('initiate','acknowledge','complete','reject','timeout','custom') NOT NULL,
  status           ENUM('pending','acknowledged','completed','rejected','timed_out') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  remote_server_id VARCHAR(128) NOT NULL,
  handshake_nonce  VARCHAR(128) NOT NULL,
  handshake_data   JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_handshake_id (handshake_id),
  UNIQUE KEY uq_handshake_nonce (handshake_nonce, owner_server_id),
  KEY idx_handshake_status (status),
  KEY idx_handshake_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
