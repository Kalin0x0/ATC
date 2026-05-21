CREATE TABLE IF NOT EXISTS atc_economy_regulation (
  id               VARCHAR(26)  NOT NULL,
  regulation_id    VARCHAR(26)  NOT NULL,
  region_id        VARCHAR(128) NULL,
  regulation_type  ENUM('price_floor','price_ceiling','supply_cap','demand_cap','subsidy','custom') NOT NULL,
  status           ENUM('active','suspended','expired','cancelled') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  regulation_nonce VARCHAR(128) NOT NULL,
  regulation_data  JSON         NOT NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_economy_regulation_id (regulation_id),
  UNIQUE KEY uq_economy_regulation_nonce (regulation_nonce, owner_server_id),
  KEY idx_economy_regulation_status (status),
  KEY idx_economy_regulation_region (region_id),
  KEY idx_economy_regulation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
