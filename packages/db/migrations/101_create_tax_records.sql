CREATE TABLE IF NOT EXISTS atc_tax_records (
  id                    VARCHAR(26)  NOT NULL,
  principal_id          VARCHAR(26)  NOT NULL,
  tax_type              ENUM('income','property','transaction','import','fine') NOT NULL,
  amount                BIGINT       NOT NULL,
  source_transaction_id VARCHAR(26)  NULL,
  period_label          VARCHAR(64)  NULL,
  status                ENUM('pending','collected','waived','disputed') NOT NULL DEFAULT 'pending',
  collected_at          DATETIME(3)  NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_tax_record_principal (principal_id),
  INDEX idx_tax_record_status (status),
  INDEX idx_tax_record_type (tax_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
