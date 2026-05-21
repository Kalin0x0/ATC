CREATE TABLE IF NOT EXISTS atc_resource_regeneration (
  id                  VARCHAR(26)  NOT NULL,
  regeneration_id     VARCHAR(26)  NOT NULL,
  resource_type       ENUM('flora','fauna','mineral','water','soil','custom') NOT NULL,
  status              ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  region_id           VARCHAR(128) NULL,
  regeneration_nonce  VARCHAR(128) NOT NULL,
  regeneration_data   JSON         NOT NULL,
  completed_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_regeneration_id (regeneration_id),
  UNIQUE KEY uq_regeneration_nonce (regeneration_nonce, owner_server_id),
  KEY idx_regeneration_status (status),
  KEY idx_regeneration_region (region_id),
  KEY idx_regeneration_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
