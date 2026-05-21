-- Phase 21 — Economy Core: payment records linked to invoices and journals
CREATE TABLE IF NOT EXISTS atc_invoice_payments (
    id          CHAR(26)        NOT NULL,
    invoice_id  CHAR(26)        NOT NULL,
    amount      DECIMAL(20,4)   NOT NULL,
    currency    VARCHAR(16)     NOT NULL DEFAULT 'USD',
    journal_id  CHAR(26)        NOT NULL,
    paid_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_ip_invoice (invoice_id),
    KEY idx_ip_journal (journal_id),
    CONSTRAINT fk_ip_invoice FOREIGN KEY (invoice_id) REFERENCES atc_invoices (id),
    CONSTRAINT fk_ip_journal FOREIGN KEY (journal_id) REFERENCES atc_financial_journals (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
