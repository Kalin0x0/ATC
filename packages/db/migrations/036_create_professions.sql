-- Phase 23 — Jobs: character profession progression records
CREATE TABLE IF NOT EXISTS atc_professions (
  id                CHAR(26)  NOT NULL,
  character_id      CHAR(26)  NOT NULL,
  job_id            CHAR(26)  NOT NULL,
  grade_id          CHAR(26)  NOT NULL,
  level             INT       NOT NULL DEFAULT 1,
  experience_points INT       NOT NULL DEFAULT 0,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_professions_char_job (character_id, job_id),
  KEY idx_professions_char  (character_id),
  KEY idx_professions_job   (job_id),
  CONSTRAINT chk_professions_level CHECK (level >= 1),
  CONSTRAINT chk_professions_xp    CHECK (experience_points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
