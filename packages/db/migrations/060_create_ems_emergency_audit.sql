CREATE TABLE atc_ems_emergency_audit (
  id            CHAR(26)     NOT NULL,
  emergency_id  CHAR(26)     NOT NULL,
  action        VARCHAR(64)  NOT NULL,
  from_status   VARCHAR(32)  NULL,
  to_status     VARCHAR(32)  NULL,
  principal_id  VARCHAR(128) NOT NULL,
  notes         TEXT         NULL,
  metadata      JSON         NOT NULL DEFAULT ('{}'),
  created_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_ems_audit_emergency  (emergency_id),
  INDEX idx_ems_audit_principal  (principal_id),
  INDEX idx_ems_audit_created    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
