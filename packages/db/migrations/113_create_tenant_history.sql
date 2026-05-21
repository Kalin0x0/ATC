CREATE TABLE IF NOT EXISTS atc_tenant_history (
  id                        VARCHAR(26)    NOT NULL,
  contract_id               VARCHAR(26)    NOT NULL,
  property_id               VARCHAR(128)   NOT NULL,
  tenant_principal_id       VARCHAR(128)   NOT NULL,
  action                    VARCHAR(64)    NOT NULL,
  performed_by_principal_id VARCHAR(128)   NULL,
  notes                     TEXT           NULL,
  created_at                DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_tenant_history_contract (contract_id),
  INDEX idx_tenant_history_property (property_id),
  INDEX idx_tenant_history_tenant (tenant_principal_id),
  INDEX idx_tenant_history_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
