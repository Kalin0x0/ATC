CREATE TABLE IF NOT EXISTS atc_environment_runtime (
  id               VARCHAR(26)    NOT NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  weather_state    VARCHAR(64)    NOT NULL DEFAULT 'clear',
  temperature      FLOAT          NOT NULL DEFAULT 20.0,
  wind_speed       FLOAT          NOT NULL DEFAULT 0.0,
  wind_direction   FLOAT          NOT NULL DEFAULT 0.0,
  visibility       FLOAT          NOT NULL DEFAULT 1.0,
  is_night         TINYINT(1)     NOT NULL DEFAULT 0,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_environment_zone (zone_id),
  INDEX idx_environment_weather (weather_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
