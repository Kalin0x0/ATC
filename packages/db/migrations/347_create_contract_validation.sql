CREATE TABLE IF NOT EXISTS atc_contract_validation (
  id               CHAR(26)     NOT NULL,
  contract_id      CHAR(26)     NOT NULL,
  contract_type    VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  contract_nonce   VARCHAR(128) NOT NULL,
  contract_data    JSON         NULL,
  validated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_contract_validation_id (contract_id),
  UNIQUE KEY uq_contract_validation_nonce (contract_nonce, owner_server_id),
  INDEX idx_contract_validation_status (status),
  INDEX idx_contract_validation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
