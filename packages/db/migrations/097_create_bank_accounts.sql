CREATE TABLE IF NOT EXISTS atc_bank_accounts (
  id                      VARCHAR(26)  NOT NULL,
  principal_id            VARCHAR(26)  NOT NULL,
  account_type            ENUM('personal','business','government','escrow') NOT NULL DEFAULT 'personal',
  balance                 BIGINT       NOT NULL DEFAULT 0,
  is_frozen               TINYINT(1)   NOT NULL DEFAULT 0,
  frozen_at               DATETIME(3)  NULL,
  frozen_by_principal_id  VARCHAR(26)  NULL,
  freeze_reason           VARCHAR(500) NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bank_account_principal_type (principal_id, account_type),
  INDEX idx_bank_account_principal (principal_id),
  INDEX idx_bank_account_frozen (is_frozen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
