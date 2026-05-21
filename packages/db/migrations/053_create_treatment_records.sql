-- Phase 26 — Medical: treatment records (append-only, never updated)
CREATE TABLE IF NOT EXISTS atc_treatment_records (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  applied_by_principal_id  CHAR(26)     NOT NULL,
  incident_id              CHAR(26)     NULL,
  type                     VARCHAR(20)  NOT NULL,
  item_id                  VARCHAR(128) NULL,
  notes                    TEXT         NULL,
  previous_trauma          VARCHAR(20)  NULL,
  resulting_trauma         VARCHAR(20)  NULL,
  metadata                 JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  applied_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_treatment_character (character_id),
  KEY idx_treatment_incident  (incident_id),
  KEY idx_treatment_type      (type),
  KEY idx_treatment_applied   (applied_at),
  CONSTRAINT chk_treatment_type CHECK (type IN ('bandage','defibrillator','medication','splint','tourniquet','cpr','revive','stabilize','transfer','other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
