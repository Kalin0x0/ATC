CREATE TABLE IF NOT EXISTS atc_supply_routes (
  id                          VARCHAR(26)   NOT NULL,
  route_id                    VARCHAR(128)  NOT NULL,
  route_name                  VARCHAR(256)  NOT NULL,
  origin_node_id              VARCHAR(128)  NOT NULL,
  destination_node_id         VARCHAR(128)  NOT NULL,
  route_type                  VARCHAR(32)   NOT NULL DEFAULT 'ground',
  distance_km                 DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  estimated_duration_minutes  INT           NOT NULL DEFAULT 60,
  is_active                   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_route_id (route_id),
  INDEX idx_route_type (route_type),
  INDEX idx_route_active (is_active),
  INDEX idx_route_origin (origin_node_id),
  INDEX idx_route_destination (destination_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
