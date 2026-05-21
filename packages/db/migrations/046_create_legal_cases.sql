-- Phase 24 — Government: legal cases (links warrants, evidence, arrests, citations)
CREATE TABLE IF NOT EXISTS atc_legal_cases (
  id                      CHAR(26)     NOT NULL,
  title                   VARCHAR(512) NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'open',
  agency_id               CHAR(26)     NOT NULL,
  created_by_principal_id CHAR(26)     NOT NULL,
  notes                   TEXT         NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_case_agency  (agency_id),
  KEY idx_case_status  (status),
  KEY idx_case_creator (created_by_principal_id),
  CONSTRAINT chk_case_status CHECK (status IN ('open','closed','archived')),
  CONSTRAINT fk_case_agency  FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
