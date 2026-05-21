CREATE TABLE IF NOT EXISTS atc_housing_payments (
  id                  VARCHAR(26)    NOT NULL,
  contract_id         VARCHAR(26)    NULL,
  from_principal_id   VARCHAR(128)   NOT NULL,
  to_principal_id     VARCHAR(128)   NOT NULL,
  amount              VARCHAR(24)    NOT NULL DEFAULT '0',
  payment_type        VARCHAR(32)    NOT NULL DEFAULT 'rent',
  status              VARCHAR(32)    NOT NULL DEFAULT 'pending',
  idempotency_key     VARCHAR(128)   NOT NULL,
  description         VARCHAR(500)   NULL,
  created_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at        DATETIME(3)    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_housing_payment_idempotency (idempotency_key),
  INDEX idx_housing_payment_contract (contract_id),
  INDEX idx_housing_payment_from (from_principal_id),
  INDEX idx_housing_payment_status (status),
  INDEX idx_housing_payment_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
