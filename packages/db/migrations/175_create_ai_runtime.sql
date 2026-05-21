CREATE TABLE IF NOT EXISTS atc_ai_runtime (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  entity_type     VARCHAR(64)   NOT NULL,
  ai_state        VARCHAR(32)   NOT NULL DEFAULT 'idle',
  behavior_mode   VARCHAR(32)   NOT NULL DEFAULT 'passive',
  owner_server_id VARCHAR(128)  NULL,
  position_data   TEXT          NOT NULL DEFAULT '{}',
  threat_level    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_runtime_entity_id (entity_id),
  KEY idx_ai_runtime_state (ai_state),
  KEY idx_ai_runtime_owner (owner_server_id),
  KEY idx_ai_runtime_last_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
