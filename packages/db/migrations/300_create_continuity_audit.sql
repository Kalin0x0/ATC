CREATE TABLE IF NOT EXISTS atc_continuity_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(64)  NOT NULL,
  continuity_id    CHAR(26)     NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_continuity_audit_event (event_type),
  INDEX idx_continuity_audit_continuity (continuity_id),
  INDEX idx_continuity_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
