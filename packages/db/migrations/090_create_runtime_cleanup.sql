CREATE TABLE atc_runtime_cleanup (
  id                      CHAR(26)     NOT NULL,
  target_type             VARCHAR(64)  NOT NULL,
  target_id               VARCHAR(128) NOT NULL,
  cleanup_reason          ENUM('timeout','manual','server_restart','owner_disconnect','scene_destroyed') NOT NULL,
  scheduled_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at            DATETIME(3)  NULL,
  node_id                 VARCHAR(128) NULL,
  PRIMARY KEY (id),
  INDEX idx_target (target_type, target_id),
  INDEX idx_pending (completed_at),
  INDEX idx_node (node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
