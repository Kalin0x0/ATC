CREATE TABLE IF NOT EXISTS atc_narrative_runtime (
  id              VARCHAR(26)   NOT NULL,
  session_id      VARCHAR(128)  NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  campaign_id     VARCHAR(128)  NULL,
  narrative_type  VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  narrative_data  TEXT          NOT NULL DEFAULT '{}',
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_narrative_session_id (session_id),
  KEY idx_narrative_entity (entity_id),
  KEY idx_narrative_status (status),
  KEY idx_narrative_server (owner_server_id),
  KEY idx_narrative_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
