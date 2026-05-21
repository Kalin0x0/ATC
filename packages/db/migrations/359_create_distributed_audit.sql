CREATE TABLE IF NOT EXISTS atc_distributed_audit (
  id               CHAR(26)     NOT NULL,
  audit_node_id    VARCHAR(128) NOT NULL,
  node_type        VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  node_data        JSON         NULL,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_distributed_audit_node_id (audit_node_id),
  INDEX idx_distributed_audit_status (status),
  INDEX idx_distributed_audit_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
