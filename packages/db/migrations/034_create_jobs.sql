-- Phase 23 — Jobs: job registry
CREATE TABLE IF NOT EXISTS atc_jobs (
  id                CHAR(26)      NOT NULL,
  slug              VARCHAR(64)   NOT NULL,
  name              VARCHAR(256)  NOT NULL,
  type              VARCHAR(20)   NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'active',
  organization_id   CHAR(26)      NULL     COMMENT 'Owning organization for org-linked jobs',
  salary_account_id CHAR(26)      NULL     COMMENT 'Financial account debited on payroll',
  metadata_json     JSON          NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_jobs_slug   (slug),
  KEY idx_jobs_type         (type),
  KEY idx_jobs_status       (status),
  KEY idx_jobs_org          (organization_id),
  CONSTRAINT chk_jobs_type   CHECK (type   IN ('civilian','organization','government','freelance','system')),
  CONSTRAINT chk_jobs_status CHECK (status IN ('active','disabled','archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
