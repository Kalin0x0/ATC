CREATE TABLE IF NOT EXISTS atc_lockdown_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(64)  NOT NULL,
  lockdown_id      CHAR(26)     NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_lockdown_audit_event (event_type),
  INDEX idx_lockdown_audit_lockdown (lockdown_id),
  INDEX idx_lockdown_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
