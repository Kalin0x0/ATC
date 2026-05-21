CREATE TABLE IF NOT EXISTS atc_cluster_nodes (
  id              VARCHAR(26)   NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  node_type       VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  address         VARCHAR(256)  NULL,
  node_nonce      VARCHAR(128)  NOT NULL,
  node_data       TEXT          NOT NULL DEFAULT '{}',
  joined_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at         DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_node_nonce (node_nonce),
  KEY idx_node_status (status),
  KEY idx_node_owner (owner_server_id),
  KEY idx_node_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
