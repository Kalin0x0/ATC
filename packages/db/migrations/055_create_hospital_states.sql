-- Phase 26 — Medical: hospital admission state (one active per character)
CREATE TABLE IF NOT EXISTS atc_hospital_states (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  admitted_by_principal_id CHAR(26)     NOT NULL,
  status                   VARCHAR(20)  NOT NULL DEFAULT 'admitted',
  facility_id              VARCHAR(128) NULL,
  incident_id              CHAR(26)     NULL,
  notes                    TEXT         NULL,
  admitted_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status_changed_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  discharged_at            DATETIME(3)  NULL,
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hospital_character (character_id),
  KEY idx_hospital_status    (status),
  KEY idx_hospital_admitted  (admitted_at),
  CONSTRAINT chk_hospital_status CHECK (status IN ('admitted','icu','surgery','discharged','deceased'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
