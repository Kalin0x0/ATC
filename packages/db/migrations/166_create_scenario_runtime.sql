CREATE TABLE IF NOT EXISTS atc_scenario_runtime (
  id              VARCHAR(26)   NOT NULL,
  scenario_id     VARCHAR(128)  NOT NULL,
  scenario_type   VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'spawning',
  mission_id      VARCHAR(26)   NULL,
  config_data     TEXT          NOT NULL DEFAULT '{}',
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  owner_server_id VARCHAR(128)  NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_scenario_scenario_id (scenario_id),
  KEY idx_scenario_status (status),
  KEY idx_scenario_mission (mission_id),
  KEY idx_scenario_last_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
