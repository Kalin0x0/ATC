CREATE TABLE IF NOT EXISTS atc_trace_runtime (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  trace_level     VARCHAR(32)   NOT NULL DEFAULT 'info',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  owner_server_id VARCHAR(128)  NOT NULL,
  expires_at      DATETIME(3)   NULL,
  trace_data      TEXT          NOT NULL DEFAULT '{}',
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_trace_runtime_entity (entity_id),
  KEY idx_trace_runtime_active (is_active),
  KEY idx_trace_runtime_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
