CREATE TABLE IF NOT EXISTS atc_snapshot_replay (
  id            VARCHAR(26)   NOT NULL,
  replay_id     VARCHAR(26)   NOT NULL,
  entity_id     VARCHAR(128)  NOT NULL,
  snapshot_id   VARCHAR(26)   NOT NULL,
  replay_status VARCHAR(32)   NOT NULL DEFAULT 'pending',
  replay_data   TEXT          NULL,
  completed_at  DATETIME(3)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_replay_id (replay_id),
  KEY idx_snapshot_replay_entity (entity_id),
  KEY idx_snapshot_replay_snapshot (snapshot_id),
  KEY idx_snapshot_replay_status (replay_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
