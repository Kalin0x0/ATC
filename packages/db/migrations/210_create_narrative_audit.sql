CREATE TABLE IF NOT EXISTS atc_narrative_audit (
  id          VARCHAR(26)   NOT NULL,
  session_id  VARCHAR(128)  NULL,
  event_type  VARCHAR(128)  NOT NULL,
  entity_id   VARCHAR(128)  NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_narrative_audit_session (session_id),
  KEY idx_narrative_audit_entity (entity_id),
  KEY idx_narrative_audit_event (event_type),
  KEY idx_narrative_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
