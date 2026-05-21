CREATE TABLE IF NOT EXISTS atc_mission_audit (
  id           VARCHAR(26)   NOT NULL,
  subject_id   VARCHAR(128)  NOT NULL,
  subject_type VARCHAR(64)   NOT NULL,
  action       VARCHAR(128)  NOT NULL,
  actor_id     VARCHAR(128)  NULL,
  detail       TEXT          NULL,
  occurred_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_mission_audit_subject (subject_id),
  KEY idx_mission_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
