-- Phase 26 — Medical: injury records (append-only, indexed by character)
CREATE TABLE IF NOT EXISTS atc_injuries (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  agency_id                CHAR(26)     NULL,
  incident_id              CHAR(26)     NULL,
  recorded_by_principal_id CHAR(26)     NOT NULL,
  region                   VARCHAR(20)  NOT NULL,
  severity                 VARCHAR(20)  NOT NULL DEFAULT 'minor',
  description              TEXT         NOT NULL,
  metadata                 JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_injury_character (character_id),
  KEY idx_injury_incident  (incident_id),
  KEY idx_injury_severity  (severity),
  KEY idx_injury_created   (created_at),
  CONSTRAINT chk_injury_region   CHECK (region   IN ('head','chest','abdomen','left_arm','right_arm','left_leg','right_leg','spine')),
  CONSTRAINT chk_injury_severity CHECK (severity IN ('minor','moderate','critical','fatal'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
