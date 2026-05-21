CREATE TABLE IF NOT EXISTS atc_release_audit (
  id               CHAR(26)     NOT NULL,
  entity_id        VARCHAR(128) NULL,
  event_type       VARCHAR(128) NOT NULL,
  event_data       JSON         NULL,
  occurred_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_release_audit_event (event_type),
  INDEX idx_release_audit_entity (entity_id),
  INDEX idx_release_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
