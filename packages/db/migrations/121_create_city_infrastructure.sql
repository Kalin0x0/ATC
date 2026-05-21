CREATE TABLE IF NOT EXISTS atc_city_infrastructure (
  id                    VARCHAR(26)    NOT NULL,
  node_id               VARCHAR(128)   NOT NULL,
  node_name             VARCHAR(255)   NOT NULL,
  infrastructure_type   VARCHAR(64)    NOT NULL DEFAULT 'other',
  status                VARCHAR(32)    NOT NULL DEFAULT 'operational',
  owner_server_id       VARCHAR(128)   NULL,
  position_x            FLOAT          NULL,
  position_y            FLOAT          NULL,
  position_z            FLOAT          NULL,
  health_percent        FLOAT          NOT NULL DEFAULT 100.0,
  last_tick_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_infra_node_id (node_id),
  INDEX idx_infra_status (status),
  INDEX idx_infra_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
