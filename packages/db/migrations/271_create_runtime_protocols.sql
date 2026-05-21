CREATE TABLE IF NOT EXISTS atc_runtime_protocols (
  id              VARCHAR(26)  NOT NULL,
  protocol_id     VARCHAR(26)  NOT NULL,
  protocol_type   ENUM('negotiation','federation','bridge','handshake','contract','custom') NOT NULL,
  status          ENUM('active','paused','terminated','degraded') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  protocol_nonce  VARCHAR(128) NOT NULL,
  protocol_data   JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_protocol_id (protocol_id),
  UNIQUE KEY uq_protocol_nonce (protocol_nonce, owner_server_id),
  KEY idx_protocol_status (status),
  KEY idx_protocol_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
