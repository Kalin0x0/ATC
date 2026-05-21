CREATE TABLE IF NOT EXISTS atc_streaming_runtime (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  streaming_state VARCHAR(32)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  last_stream_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_streaming_runtime_entity (entity_id),
  KEY idx_streaming_runtime_server (owner_server_id),
  KEY idx_streaming_runtime_state (streaming_state),
  KEY idx_streaming_runtime_stream (last_stream_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
