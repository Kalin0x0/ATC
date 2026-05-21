CREATE TABLE IF NOT EXISTS atc_runtime_consistency (
  id               VARCHAR(26)  NOT NULL,
  node_id          VARCHAR(128) NOT NULL,
  consistency_type ENUM('eventual','strong','causal','sequential','custom') NOT NULL,
  status           ENUM('consistent','diverged','reconciling','unknown') NOT NULL DEFAULT 'consistent',
  owner_server_id  VARCHAR(128) NOT NULL,
  consistency_data JSON         NOT NULL,
  checked_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_consistency_node (node_id),
  KEY idx_consistency_status (status),
  KEY idx_consistency_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
