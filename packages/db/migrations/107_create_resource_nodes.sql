CREATE TABLE IF NOT EXISTS atc_resource_nodes (
  id                    VARCHAR(26)   NOT NULL,
  node_id               VARCHAR(128)  NOT NULL,
  label                 VARCHAR(255)  NOT NULL,
  node_type             ENUM('mine','oil_field','farm','dock','warehouse','lab','safehouse','other') NOT NULL DEFAULT 'other',
  controlling_faction_id VARCHAR(26)  NULL,
  yield_rate            DECIMAL(8,4)  NOT NULL DEFAULT 1.0000,
  is_active             TINYINT(1)    NOT NULL DEFAULT 1,
  center_x              FLOAT         NULL,
  center_y              FLOAT         NULL,
  center_z              FLOAT         NULL,
  last_captured_at      DATETIME(3)   NULL,
  created_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_resource_node_id (node_id),
  INDEX idx_resource_node_faction (controlling_faction_id),
  INDEX idx_resource_node_type_active (node_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
