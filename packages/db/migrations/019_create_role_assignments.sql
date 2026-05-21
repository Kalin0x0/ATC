-- ATC Migration 019 — Role Assignments
-- Persistent role grants for IAM principals. UNIQUE on (principal_id, role_id) so
-- a role cannot be double-assigned; re-assigning is idempotent via INSERT IGNORE.
-- expires_at NULL means the assignment never expires.

CREATE TABLE IF NOT EXISTS atc_role_assignments (
    id              CHAR(26)        NOT NULL,
    principal_id    CHAR(26)        NOT NULL,
    role_id         VARCHAR(64)     NOT NULL,
    assigned_by     VARCHAR(128)    NOT NULL,
    assigned_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at      DATETIME(3)     NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_principal_role (principal_id, role_id),
    KEY idx_role_assignments_principal (principal_id),
    KEY idx_role_assignments_expires   (expires_at),

    CONSTRAINT fk_role_assign_principal
        FOREIGN KEY (principal_id) REFERENCES atc_principals (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
