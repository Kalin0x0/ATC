CREATE TABLE IF NOT EXISTS atc_core_closure_audit (
  id          CHAR(26)     NOT NULL,
  entity_id   VARCHAR(128) NOT NULL,
  event_type  VARCHAR(128) NOT NULL,
  event_data  JSON,
  occurred_at DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  KEY idx_core_closure_audit_entity (entity_id),
  KEY idx_core_closure_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
