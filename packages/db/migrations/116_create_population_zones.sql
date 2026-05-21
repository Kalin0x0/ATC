CREATE TABLE IF NOT EXISTS atc_population_zones (
  id                   VARCHAR(26)    NOT NULL,
  zone_id              VARCHAR(128)   NOT NULL,
  zone_name            VARCHAR(255)   NOT NULL,
  max_population       INT            NOT NULL DEFAULT 50,
  current_population   INT            NOT NULL DEFAULT 0,
  density_multiplier   FLOAT          NOT NULL DEFAULT 1.0,
  is_active            TINYINT(1)     NOT NULL DEFAULT 1,
  last_tick_at         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_population_zone_id (zone_id),
  INDEX idx_pop_zone_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
