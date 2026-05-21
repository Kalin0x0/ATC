CREATE TABLE IF NOT EXISTS atc_territory_claims (
  id                      VARCHAR(26)   NOT NULL,
  territory_id            VARCHAR(26)   NOT NULL,
  faction_id              VARCHAR(26)   NOT NULL,
  claimed_by_principal_id VARCHAR(26)   NOT NULL,
  claim_type              ENUM('capture','purchase','grant','inheritance') NOT NULL,
  status                  ENUM('active','superseded','released') NOT NULL DEFAULT 'active',
  claim_nonce             VARCHAR(128)  NOT NULL,
  claimed_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at             DATETIME(3)   NULL,
  superseded_at           DATETIME(3)   NULL,
  notes                   TEXT          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_territory_claim_nonce (claim_nonce),
  INDEX idx_territory_claim_territory_status (territory_id, status),
  INDEX idx_territory_claim_faction (faction_id),
  INDEX idx_territory_claim_claimed_at (claimed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
