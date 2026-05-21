CREATE TABLE IF NOT EXISTS atc_accounts (
  id                  CHAR(26)        NOT NULL,
  primary_identifier  VARCHAR(128)    NOT NULL,
  preferred_language  VARCHAR(8)      NOT NULL DEFAULT 'en',
  status              ENUM('active', 'banned', 'suspended') NOT NULL DEFAULT 'active',
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_primary_identifier (primary_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_account_identifiers (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  account_id          CHAR(26)        NOT NULL,
  identifier_type     VARCHAR(32)     NOT NULL,
  identifier          VARCHAR(128)    NOT NULL,
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_identifiers_type_value (identifier_type, identifier),
  UNIQUE KEY uq_identifiers_account_type (account_id, identifier_type),
  CONSTRAINT fk_identifiers_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
