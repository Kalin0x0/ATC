CREATE TABLE IF NOT EXISTS atc_ai_response_runtime (
  id              VARCHAR(26)   NOT NULL,
  response_id     VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  response_type   VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'activating',
  target_id       VARCHAR(128)  NULL,
  tactical_data   TEXT          NOT NULL DEFAULT '{}',
  owner_server_id VARCHAR(128)  NULL,
  activated_at    DATETIME(3)   NULL,
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_response_id (response_id),
  KEY idx_ai_response_entity (entity_id),
  KEY idx_ai_response_status (status),
  KEY idx_ai_response_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
