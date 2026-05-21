CREATE TABLE IF NOT EXISTS atc_financial_flags (
  id                       VARCHAR(26)  NOT NULL,
  principal_id             VARCHAR(26)  NOT NULL,
  flag_type                ENUM('suspicious_transfer','velocity_breach','structuring','large_withdrawal','unusual_pattern','manual_review') NOT NULL,
  severity                 ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  amount_involved          BIGINT       NULL,
  transaction_id           VARCHAR(26)  NULL,
  description              VARCHAR(1000) NOT NULL,
  is_resolved              TINYINT(1)   NOT NULL DEFAULT 0,
  resolved_at              DATETIME(3)  NULL,
  resolved_by_principal_id VARCHAR(26)  NULL,
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_financial_flag_principal (principal_id),
  INDEX idx_financial_flag_severity_resolved (severity, is_resolved),
  INDEX idx_financial_flag_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
