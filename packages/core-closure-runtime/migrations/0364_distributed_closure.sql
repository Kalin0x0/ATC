CREATE TABLE IF NOT EXISTS atc_distributed_closure (
  id                 CHAR(26)     NOT NULL,
  closure_node_id    VARCHAR(128) NOT NULL,
  node_type          VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id    VARCHAR(128) NOT NULL,
  closure_node_data  JSON,
  synced_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_distributed_closure_node_id (closure_node_id),
  KEY idx_distributed_closure_status (status),
  KEY idx_distributed_closure_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
