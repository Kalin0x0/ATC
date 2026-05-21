CREATE TABLE IF NOT EXISTS atc_vehicle_fuel (
  id                 VARCHAR(26)    NOT NULL,
  vehicle_runtime_id VARCHAR(26)    NOT NULL,
  tank_capacity      DECIMAL(10,2)  NOT NULL DEFAULT 60.00,
  current_fuel       DECIMAL(10,2)  NOT NULL DEFAULT 60.00,
  fuel_grade         ENUM('regular','premium','diesel','electric') NOT NULL DEFAULT 'regular',
  consumption_rate   DECIMAL(8,4)   NOT NULL DEFAULT 0.0500,
  last_refuel_at     DATETIME(3)    NULL,
  last_sync_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_fuel_runtime_id (vehicle_runtime_id),
  INDEX idx_vehicle_fuel_last_sync (last_sync_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
