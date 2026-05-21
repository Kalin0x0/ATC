CREATE TABLE IF NOT EXISTS atc_failover_audit (
  id          VARCHAR(26)   NOT NULL,
  failover_id VARCHAR(128)  NULL,
  event_type  VARCHAR(128)  NOT NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_failover_audit_failover (failover_id),
  KEY idx_failover_audit_event (event_type),
  KEY idx_failover_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
