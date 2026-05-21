-- Phase 21 — Economy Core: double-entry journal lines (debit/credit)
-- Each journal must have sum(debits) == sum(credits); enforced in LedgerService.
CREATE TABLE IF NOT EXISTS atc_financial_entries (
    id          CHAR(26)        NOT NULL,
    journal_id  CHAR(26)        NOT NULL,
    account_id  CHAR(26)        NOT NULL,
    entry_type  VARCHAR(10)     NOT NULL,
    amount      DECIMAL(20,4)   NOT NULL,
    currency    VARCHAR(16)     NOT NULL DEFAULT 'USD',
    created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_fe_journal (journal_id),
    KEY idx_fe_account (account_id),
    CONSTRAINT fk_fe_journal FOREIGN KEY (journal_id) REFERENCES atc_financial_journals (id) ON DELETE CASCADE,
    CONSTRAINT fk_fe_account FOREIGN KEY (account_id) REFERENCES atc_financial_accounts (id),
    CONSTRAINT chk_fe_entry_type CHECK (entry_type IN ('debit', 'credit')),
    CONSTRAINT chk_fe_amount     CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
