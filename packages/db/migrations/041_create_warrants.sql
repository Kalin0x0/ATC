-- Phase 24 — Government: arrest warrants
CREATE TABLE IF NOT EXISTS atc_warrants (
  id                     CHAR(26)    NOT NULL,
  character_id           CHAR(26)    NOT NULL,
  issued_by_principal_id CHAR(26)    NOT NULL,
  agency_id              CHAR(26)    NOT NULL,
  severity               VARCHAR(20) NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'active',
  reason                 TEXT        NOT NULL,
  expires_at             DATETIME(3) NULL,
  executed_at            DATETIME(3) NULL,
  revoked_at             DATETIME(3) NULL,
  revoke_reason          TEXT        NULL,
  created_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_warrant_char     (character_id),
  KEY idx_warrant_agency   (agency_id),
  KEY idx_warrant_status   (status),
  KEY idx_warrant_severity (severity),
  CONSTRAINT chk_warrant_severity CHECK (severity IN ('infraction','misdemeanor','felony')),
  CONSTRAINT chk_warrant_status   CHECK (status   IN ('active','executed','expired','revoked')),
  CONSTRAINT fk_warrant_agency    FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
