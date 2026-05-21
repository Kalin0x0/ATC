-- Phase 21 — Economy Core: organizations (businesses, factions, government, charities)
CREATE TABLE IF NOT EXISTS atc_organizations (
    id                   CHAR(26)        NOT NULL,
    name                 VARCHAR(64)     NOT NULL,
    display_name         VARCHAR(256)    NOT NULL,
    type                 VARCHAR(20)     NOT NULL DEFAULT 'business',
    status               VARCHAR(20)     NOT NULL DEFAULT 'active',
    treasury_account_id  CHAR(26)        NULL,
    owner_id             VARCHAR(128)    NOT NULL,
    metadata             JSON            NULL,
    created_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_org_name  (name),
    KEY idx_org_owner       (owner_id),
    KEY idx_org_status      (status),
    CONSTRAINT chk_org_type   CHECK (type   IN ('business', 'faction', 'government', 'charity')),
    CONSTRAINT chk_org_status CHECK (status IN ('active', 'suspended', 'dissolved'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
