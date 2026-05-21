CREATE TABLE atc_ems_revive_audit (
  id                        CHAR(26)     NOT NULL,
  character_id              VARCHAR(128) NOT NULL,
  emergency_id              CHAR(26)     NULL,
  revived_by_principal_id   VARCHAR(128) NOT NULL,
  previous_state            VARCHAR(32)  NOT NULL,
  resulting_state           VARCHAR(32)  NOT NULL,
  notes                     TEXT         NULL,
  revived_at                DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_revive_audit_character  (character_id),
  INDEX idx_revive_audit_principal  (revived_by_principal_id),
  INDEX idx_revive_audit_revived    (revived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
