CREATE TABLE IF NOT EXISTS atc_vehicle_damage_runtime (
  id                  VARCHAR(26)  NOT NULL,
  vehicle_runtime_id  VARCHAR(26)  NOT NULL,
  engine_health       DECIMAL(7,2) NOT NULL DEFAULT 1000.00,
  body_health         DECIMAL(7,2) NOT NULL DEFAULT 1000.00,
  fuel_tank_health    DECIMAL(7,2) NOT NULL DEFAULT 1000.00,
  panel_damage        JSON         NOT NULL,
  tire_state          JSON         NOT NULL,
  is_engine_destroyed TINYINT(1)   NOT NULL DEFAULT 0,
  is_on_fire          TINYINT(1)   NOT NULL DEFAULT 0,
  last_sync_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_damage_runtime_vehicle (vehicle_runtime_id),
  INDEX idx_damage_on_fire (is_on_fire)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
