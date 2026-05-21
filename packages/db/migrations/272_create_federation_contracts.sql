CREATE TABLE IF NOT EXISTS atc_federation_contracts (
  id               VARCHAR(26)  NOT NULL,
  contract_id      VARCHAR(26)  NOT NULL,
  contract_type    ENUM('peer','subordinate','primary','relay','custom') NOT NULL,
  status           ENUM('pending','active','expired','revoked') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_server_id VARCHAR(128) NOT NULL,
  contract_nonce   VARCHAR(128) NOT NULL,
  contract_data    JSON         NOT NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_contract_id (contract_id),
  UNIQUE KEY uq_contract_nonce (contract_nonce, owner_server_id),
  KEY idx_contract_status (status),
  KEY idx_contract_owner (owner_server_id),
  KEY idx_contract_target (target_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
