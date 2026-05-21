-- Phase 21 — Economy Core: double-entry journal headers (one per atomic commit)
CREATE TABLE IF NOT EXISTS atc_financial_journals (
    id               CHAR(26)        NOT NULL,
    idempotency_key  VARCHAR(256)    NOT NULL,
    description      VARCHAR(512)    NOT NULL,
    source           VARCHAR(20)     NOT NULL DEFAULT 'system',
    status           VARCHAR(20)     NOT NULL DEFAULT 'committed',
    reference_id     VARCHAR(128)    NULL,
    reference_type   VARCHAR(64)     NULL,
    reversal_of_id   CHAR(26)        NULL,
    committed_at     DATETIME(3)     NULL,
    reversed_at      DATETIME(3)     NULL,
    created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_journal_idempotency (idempotency_key),
    KEY idx_journal_status    (status),
    KEY idx_journal_reference (reference_type, reference_id),
    KEY idx_journal_reversal  (reversal_of_id),
    CONSTRAINT chk_journal_status CHECK (status IN ('pending', 'committed', 'reversed')),
    CONSTRAINT chk_journal_source CHECK (source IN ('system', 'admin', 'api', 'gameplay'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
