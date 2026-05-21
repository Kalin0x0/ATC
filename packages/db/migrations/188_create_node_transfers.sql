CREATE TABLE IF NOT EXISTS atc_node_transfers (
  id              VARCHAR(26)   NOT NULL,
  transfer_id     VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  from_server_id  VARCHAR(128)  NOT NULL,
  to_server_id    VARCHAR(128)  NOT NULL,
  transfer_status VARCHAR(32)   NOT NULL DEFAULT 'initiated',
  transfer_data   TEXT          NULL,
  completed_at    DATETIME(3)   NULL,
  failed_at       DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_transfer_id (transfer_id),
  KEY idx_node_transfer_entity (entity_id),
  KEY idx_node_transfer_status (transfer_status),
  KEY idx_node_transfer_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
