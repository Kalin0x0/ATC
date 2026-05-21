CREATE TABLE IF NOT EXISTS atc_world_orchestration_audit (
  id          VARCHAR(26)   NOT NULL,
  subject_id  VARCHAR(128)  NOT NULL,
  action      VARCHAR(128)  NOT NULL,
  server_id   VARCHAR(128)  NULL,
  detail      TEXT          NULL,
  occurred_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_world_orch_audit_subject (subject_id),
  KEY idx_world_orch_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
