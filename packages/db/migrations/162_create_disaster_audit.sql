CREATE TABLE IF NOT EXISTS atc_disaster_audit (
  id           VARCHAR(26)    NOT NULL,
  subject_id   VARCHAR(128)   NOT NULL,
  subject_type VARCHAR(64)    NOT NULL,
  action       VARCHAR(128)   NOT NULL,
  actor_id     VARCHAR(128)   NULL,
  detail       TEXT           NULL,
  occurred_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_disaster_audit_subject (subject_id),
  INDEX idx_disaster_audit_type (subject_type),
  INDEX idx_disaster_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
