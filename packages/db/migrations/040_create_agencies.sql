-- Phase 24 — Government: agencies (police, EMS, courts, corrections, government)
CREATE TABLE IF NOT EXISTS atc_agencies (
  id              CHAR(26)     NOT NULL,
  slug            VARCHAR(64)  NOT NULL,
  name            VARCHAR(256) NOT NULL,
  type            VARCHAR(32)  NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  organization_id CHAR(26)     NULL,
  description     TEXT         NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_agency_slug (slug),
  KEY idx_agency_type   (type),
  KEY idx_agency_status (status),
  KEY idx_agency_org    (organization_id),
  CONSTRAINT chk_agency_type   CHECK (type   IN ('police','ems','government','court','corrections')),
  CONSTRAINT chk_agency_status CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
