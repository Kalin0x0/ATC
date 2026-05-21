-- Phase 23 — Jobs: payroll runs and per-employee entries
CREATE TABLE IF NOT EXISTS atc_payroll_runs (
  id                      CHAR(26)      NOT NULL,
  organization_id         CHAR(26)      NOT NULL,
  period_start            DATETIME(3)   NOT NULL,
  period_end              DATETIME(3)   NOT NULL,
  status                  VARCHAR(20)   NOT NULL DEFAULT 'preview',
  total_amount            DECIMAL(15,4) NOT NULL DEFAULT '0.0000',
  currency                VARCHAR(16)   NOT NULL DEFAULT 'USD',
  employee_count          INT           NOT NULL DEFAULT 0,
  ledger_journal_id       CHAR(26)      NULL     COMMENT 'Set after successful payroll commit',
  idempotency_key         VARCHAR(256)  NOT NULL,
  failure_reason          TEXT          NULL,
  created_by_principal_id CHAR(26)      NOT NULL,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_idempotency (idempotency_key),
  KEY idx_payroll_org    (organization_id),
  KEY idx_payroll_status (status),
  KEY idx_payroll_period (organization_id, period_start, period_end),
  CONSTRAINT chk_payroll_status       CHECK (status IN ('preview','pending','completed','failed')),
  CONSTRAINT chk_payroll_period_order CHECK (period_end > period_start),
  CONSTRAINT chk_payroll_total        CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_payroll_run_entries (
  id             CHAR(26)      NOT NULL,
  payroll_run_id CHAR(26)      NOT NULL,
  contract_id    CHAR(26)      NOT NULL,
  character_id   CHAR(26)      NOT NULL,
  grade_id       CHAR(26)      NOT NULL,
  hours_worked   DECIMAL(8,2)  NOT NULL DEFAULT '0.00',
  salary_amount  DECIMAL(15,4) NOT NULL DEFAULT '0.0000',
  currency       VARCHAR(16)   NOT NULL DEFAULT 'USD',
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_payroll_entries_run      (payroll_run_id),
  KEY idx_payroll_entries_contract (contract_id),
  KEY idx_payroll_entries_char     (character_id),
  CONSTRAINT fk_payroll_entries_run FOREIGN KEY (payroll_run_id)
    REFERENCES atc_payroll_runs (id) ON DELETE CASCADE,
  CONSTRAINT chk_payroll_entries_salary CHECK (salary_amount >= 0),
  CONSTRAINT chk_payroll_entries_hours  CHECK (hours_worked >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
