CREATE TABLE IF NOT EXISTS atc_vehicle_runtime_metrics (
  id                      VARCHAR(26)  NOT NULL,
  vehicle_runtime_id      VARCHAR(26)  NOT NULL,
  distance_traveled       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  top_speed_recorded      DECIMAL(7,2)  NOT NULL DEFAULT 0.00,
  total_collisions        INT UNSIGNED  NOT NULL DEFAULT 0,
  engine_runtime_minutes  INT UNSIGNED  NOT NULL DEFAULT 0,
  last_heartbeat_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_metrics_vehicle (vehicle_runtime_id),
  INDEX idx_runtime_metrics_heartbeat (last_heartbeat_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
