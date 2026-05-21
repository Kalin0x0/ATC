CREATE TABLE IF NOT EXISTS atc_regional_simulation (
  id              VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NOT NULL,
  simulation_type VARCHAR(32)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  simulation_data TEXT          NOT NULL DEFAULT '{}',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_regional_simulation_region (region_id),
  KEY idx_regional_simulation_server (owner_server_id),
  KEY idx_regional_simulation_active (is_active),
  KEY idx_regional_simulation_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
