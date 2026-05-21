CREATE TABLE IF NOT EXISTS atc_recovery_snapshots (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  snapshot_type   VARCHAR(64)   NOT NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  snapshot_data   TEXT          NOT NULL DEFAULT '{}',
  sequence_number INT           NOT NULL DEFAULT 0,
  is_applied      TINYINT(1)    NOT NULL DEFAULT 0,
  applied_at      DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_recovery_snapshot_entity (entity_id),
  KEY idx_recovery_snapshot_applied (is_applied),
  KEY idx_recovery_snapshot_server (owner_server_id),
  KEY idx_recovery_snapshot_seq (sequence_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
