-- Phase 26 — Medical: one active trauma state per character (upsert pattern)
CREATE TABLE IF NOT EXISTS atc_trauma_states (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  state                    VARCHAR(20)  NOT NULL DEFAULT 'stable',
  previous_state           VARCHAR(20)  NULL,
  updated_by_principal_id  CHAR(26)     NOT NULL,
  notes                    TEXT         NULL,
  state_changed_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_trauma_character (character_id),
  KEY idx_trauma_state   (state),
  KEY idx_trauma_updated (updated_at),
  CONSTRAINT chk_trauma_state CHECK (state IN ('stable','bleeding','unconscious','cardiac_arrest','fractured','pain_shock','stabilized','deceased'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
