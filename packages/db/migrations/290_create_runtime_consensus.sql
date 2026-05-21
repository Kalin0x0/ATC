CREATE TABLE IF NOT EXISTS atc_runtime_consensus (
  id               CHAR(26)     NOT NULL,
  consensus_id     CHAR(26)     NOT NULL,
  consensus_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'proposed',
  owner_server_id  VARCHAR(128) NOT NULL,
  consensus_nonce  VARCHAR(128) NOT NULL,
  consensus_data   JSON         NULL,
  committed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_consensus_id (consensus_id),
  UNIQUE KEY uq_runtime_consensus_nonce (consensus_nonce, owner_server_id),
  INDEX idx_runtime_consensus_status (status),
  INDEX idx_runtime_consensus_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
