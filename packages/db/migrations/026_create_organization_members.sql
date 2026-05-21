-- Phase 21 — Economy Core: organization membership with role and optional expiry
CREATE TABLE IF NOT EXISTS atc_organization_members (
    id               CHAR(26)        NOT NULL,
    organization_id  CHAR(26)        NOT NULL,
    character_id     VARCHAR(128)    NOT NULL,
    role             VARCHAR(20)     NOT NULL DEFAULT 'employee',
    joined_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at       DATETIME(3)     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_org_member    (organization_id, character_id),
    KEY idx_member_character    (character_id),
    KEY idx_member_org_role     (organization_id, role),
    CONSTRAINT fk_member_org  FOREIGN KEY (organization_id) REFERENCES atc_organizations (id) ON DELETE CASCADE,
    CONSTRAINT chk_member_role CHECK (role IN ('owner', 'director', 'accountant', 'employee', 'auditor'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
