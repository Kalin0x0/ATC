-- ATC Migration 020 — Capability Assignments
-- Individual capability grants for IAM principals. UNIQUE on (principal_id, capability).
-- Trust-level enforcement still applies at authorization time; this table only records grants.

CREATE TABLE IF NOT EXISTS atc_capability_assignments (
    id              CHAR(26)        NOT NULL,
    principal_id    CHAR(26)        NOT NULL,
    capability      VARCHAR(128)    NOT NULL,
    granted_by      VARCHAR(128)    NOT NULL,
    granted_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at      DATETIME(3)     NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_principal_capability (principal_id, capability),
    KEY idx_capability_principal (principal_id),
    KEY idx_capability_expires   (expires_at),

    CONSTRAINT fk_capability_principal
        FOREIGN KEY (principal_id) REFERENCES atc_principals (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
