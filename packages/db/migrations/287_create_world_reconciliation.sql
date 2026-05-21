CREATE TABLE IF NOT EXISTS atc_world_reconciliation (
  id                   VARCHAR(26)  NOT NULL,
  reconciliation_id    VARCHAR(26)  NOT NULL,
  reconciliation_type  ENUM('delta_sync','full_sync','conflict_resolve','merge','rollback','custom') NOT NULL,
  status               ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id      VARCHAR(128) NOT NULL,
  reconciliation_nonce VARCHAR(128) NOT NULL,
  reconciliation_data  JSON         NOT NULL,
  completed_at         DATETIME(3)  NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reconciliation_id (reconciliation_id),
  UNIQUE KEY uq_reconciliation_nonce (reconciliation_nonce, owner_server_id),
  KEY idx_reconciliation_status (status),
  KEY idx_reconciliation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
