-- Phase 24 — Government: citations / fines (ledger-backed payments)
CREATE TABLE IF NOT EXISTS atc_citations (
  id                     CHAR(26)      NOT NULL,
  character_id           CHAR(26)      NOT NULL,
  issued_by_principal_id CHAR(26)      NOT NULL,
  agency_id              CHAR(26)      NOT NULL,
  reason                 TEXT          NOT NULL,
  amount                 DECIMAL(15,4) NOT NULL,
  currency               VARCHAR(16)   NOT NULL DEFAULT 'USD',
  status                 VARCHAR(20)   NOT NULL DEFAULT 'unpaid',
  ledger_journal_id      CHAR(26)      NULL     COMMENT 'Set after successful ledger-backed payment',
  idempotency_key        VARCHAR(256)  NOT NULL,
  paid_at                DATETIME(3)   NULL,
  created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_citation_idempotency (idempotency_key),
  KEY idx_citation_char   (character_id),
  KEY idx_citation_agency (agency_id),
  KEY idx_citation_status (status),
  CONSTRAINT chk_citation_status CHECK (status IN ('unpaid','paid','voided','disputed')),
  CONSTRAINT chk_citation_amount CHECK (amount >= 0),
  CONSTRAINT fk_citation_agency  FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
