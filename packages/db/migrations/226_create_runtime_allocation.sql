CREATE TABLE IF NOT EXISTS atc_runtime_allocation (
  id              VARCHAR(26)   NOT NULL,
  allocation_id   VARCHAR(128)  NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  allocation_data TEXT          NOT NULL DEFAULT '{}',
  allocated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at     DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_allocation_entity (entity_id),
  KEY idx_allocation_node (node_id),
  KEY idx_allocation_status (status),
  KEY idx_allocation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
