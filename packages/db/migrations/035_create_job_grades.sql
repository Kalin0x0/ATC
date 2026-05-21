-- Phase 23 — Jobs: pay grades within a job
CREATE TABLE IF NOT EXISTS atc_job_grades (
  id               CHAR(26)      NOT NULL,
  job_id           CHAR(26)      NOT NULL,
  slug             VARCHAR(64)   NOT NULL,
  name             VARCHAR(256)  NOT NULL,
  level            INT           NOT NULL DEFAULT 0 COMMENT 'Higher = more senior',
  salary_amount    DECIMAL(15,4) NOT NULL DEFAULT '0.0000',
  salary_currency  VARCHAR(16)   NOT NULL DEFAULT 'USD',
  permissions_json JSON          NULL     COMMENT 'Array of permission key strings',
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_job_grades_slug  (job_id, slug),
  KEY idx_job_grades_job         (job_id),
  KEY idx_job_grades_level       (job_id, level),
  CONSTRAINT chk_job_grades_salary  CHECK (salary_amount >= 0),
  CONSTRAINT chk_job_grades_level   CHECK (level >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
