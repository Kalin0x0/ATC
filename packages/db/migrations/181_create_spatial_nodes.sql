CREATE TABLE IF NOT EXISTS atc_spatial_nodes (
  id              VARCHAR(26)   NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  node_type       VARCHAR(64)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  region_id       VARCHAR(128)  NULL,
  position_data   TEXT          NULL,
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_spatial_node_id (node_id),
  KEY idx_spatial_node_server (owner_server_id),
  KEY idx_spatial_node_region (region_id),
  KEY idx_spatial_node_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
