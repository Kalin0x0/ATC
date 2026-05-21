CREATE TABLE IF NOT EXISTS atc_protocol_registry (
  id              VARCHAR(26)  NOT NULL,
  node_id         VARCHAR(128) NOT NULL,
  entry_type      ENUM('service','gateway','broker','proxy','custom') NOT NULL,
  status          ENUM('registered','deregistered','unreachable') NOT NULL DEFAULT 'registered',
  owner_server_id VARCHAR(128) NOT NULL,
  endpoint_data   JSON         NOT NULL,
  registered_at   DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_registry_node (node_id),
  KEY idx_registry_status (status),
  KEY idx_registry_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
