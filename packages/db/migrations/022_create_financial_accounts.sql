-- Phase 21 — Economy Core: financial accounts (ledger accounts)
CREATE TABLE IF NOT EXISTS atc_financial_accounts (
    id              CHAR(26)        NOT NULL,
    owner_type      VARCHAR(20)     NOT NULL,
    owner_id        VARCHAR(128)    NOT NULL,
    account_type    VARCHAR(20)     NOT NULL,
    currency        VARCHAR(16)     NOT NULL DEFAULT 'USD',
    balance         DECIMAL(20,4)   NOT NULL DEFAULT 0.0000,
    balance_version BIGINT          NOT NULL DEFAULT 0,
    status          VARCHAR(20)     NOT NULL DEFAULT 'active',
    metadata        JSON            NULL,
    created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_fa_owner      (owner_type, owner_id),
    KEY idx_fa_status     (status),
    KEY idx_fa_currency   (currency),
    CONSTRAINT chk_fa_owner_type  CHECK (owner_type   IN ('character', 'organization', 'system')),
    CONSTRAINT chk_fa_type        CHECK (account_type IN ('cash', 'bank', 'treasury', 'escrow', 'system')),
    CONSTRAINT chk_fa_status      CHECK (status       IN ('active', 'frozen', 'closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
