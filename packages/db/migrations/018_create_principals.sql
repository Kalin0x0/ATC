-- ATC Migration 018 — IAM Principal Store
-- Stores persistent principal records (accounts, services, plugins, system actors).
-- Roles and capabilities are in separate tables to allow individual grant/revoke tracking.
-- direct_permissions and direct_denies are JSON arrays for per-principal overrides.

CREATE TABLE IF NOT EXISTS atc_principals (
    id                  CHAR(26)        NOT NULL,
    principal_type      VARCHAR(20)     NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'active',
    display_name        VARCHAR(256)    NOT NULL,
    account_id          CHAR(26)        NULL,
    trust_level         VARCHAR(20)     NULL,
    direct_permissions  JSON            NOT NULL DEFAULT (JSON_ARRAY()),
    direct_denies       JSON            NOT NULL DEFAULT (JSON_ARRAY()),
    metadata            JSON            NULL,
    created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    KEY idx_principals_type   (principal_type),
    KEY idx_principals_status (status),
    KEY idx_principals_account (account_id),

    CONSTRAINT chk_principal_type   CHECK (principal_type IN ('account', 'service', 'plugin', 'system')),
    CONSTRAINT chk_principal_status CHECK (status IN ('active', 'disabled', 'suspended')),
    CONSTRAINT chk_trust_level      CHECK (trust_level IS NULL OR trust_level IN ('internal', 'trusted', 'untrusted', 'restricted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
