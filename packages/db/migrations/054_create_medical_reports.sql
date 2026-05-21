-- Phase 26 — Medical: medical reports (immutable after closure)
CREATE TABLE IF NOT EXISTS atc_medical_reports (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  created_by_principal_id  CHAR(26)     NOT NULL,
  incident_id              CHAR(26)     NULL,
  arrest_id                CHAR(26)     NULL,
  diagnosis                TEXT         NOT NULL,
  notes                    TEXT         NOT NULL DEFAULT '',
  injury_ids               JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  treatment_ids            JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  vitals_snapshot          JSON         NULL,
  closed_at                DATETIME(3)  NULL,
  closed_by_principal_id   CHAR(26)     NULL,
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_report_character (character_id),
  KEY idx_report_incident  (incident_id),
  KEY idx_report_closed    (closed_at),
  KEY idx_report_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
