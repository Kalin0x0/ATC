-- Phase 24 — Government: arrest records (append-only, no updated_at)
CREATE TABLE IF NOT EXISTS atc_arrest_records (
  id                       CHAR(26)    NOT NULL,
  character_id             CHAR(26)    NOT NULL,
  arrested_by_principal_id CHAR(26)    NOT NULL,
  agency_id                CHAR(26)    NOT NULL,
  warrant_id               CHAR(26)    NULL     COMMENT 'NULL when override capability used instead of active warrant',
  reason                   TEXT        NOT NULL,
  severity                 VARCHAR(20) NOT NULL,
  notes                    TEXT        NULL,
  created_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_arrest_char    (character_id),
  KEY idx_arrest_agency  (agency_id),
  KEY idx_arrest_warrant (warrant_id),
  KEY idx_arrest_created (created_at),
  CONSTRAINT chk_arrest_severity CHECK (severity IN ('infraction','misdemeanor','felony')),
  CONSTRAINT fk_arrest_agency    FOREIGN KEY (agency_id)  REFERENCES atc_agencies (id),
  CONSTRAINT fk_arrest_warrant   FOREIGN KEY (warrant_id) REFERENCES atc_warrants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
