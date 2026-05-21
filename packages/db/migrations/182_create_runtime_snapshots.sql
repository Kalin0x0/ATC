CREATE TABLE IF NOT EXISTS atc_runtime_snapshots (
  id              VARCHAR(26)   NOT NULL,
  snapshot_id     VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  snapshot_type   VARCHAR(32)   NOT NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  snapshot_data   TEXT          NULL,
  sequence_number BIGINT        NOT NULL DEFAULT 0,
  is_replayed     TINYINT(1)    NOT NULL DEFAULT 0,
  replayed_at     DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_snapshot_id (snapshot_id),
  KEY idx_snapshot_entity (entity_id),
  KEY idx_snapshot_entity_seq (entity_id, sequence_number),
  KEY idx_snapshot_replayed (is_replayed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
