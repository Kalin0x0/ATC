CREATE TABLE IF NOT EXISTS atc_node_lifecycle (
  id              VARCHAR(26)   NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  lifecycle_type  VARCHAR(64)   NOT NULL DEFAULT 'standard',
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  owner_server_id VARCHAR(128)  NOT NULL,
  lifecycle_data  TEXT          NOT NULL DEFAULT '{}',
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_node_lifecycle_node_id (node_id),
  KEY idx_node_lifecycle_active (is_active),
  KEY idx_node_lifecycle_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
