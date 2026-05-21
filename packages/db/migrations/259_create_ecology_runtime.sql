CREATE TABLE IF NOT EXISTS atc_ecology_runtime (
  id               VARCHAR(26)  NOT NULL,
  ecology_id       VARCHAR(26)  NOT NULL,
  ecology_type     ENUM('forest','ocean','desert','tundra','urban','custom') NOT NULL,
  status           ENUM('stable','degrading','recovering','critical') NOT NULL DEFAULT 'stable',
  owner_server_id  VARCHAR(128) NOT NULL,
  region_id        VARCHAR(128) NULL,
  ecology_nonce    VARCHAR(128) NOT NULL,
  ecology_data     JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ecology_id (ecology_id),
  UNIQUE KEY uq_ecology_nonce (ecology_nonce, owner_server_id),
  KEY idx_ecology_status (status),
  KEY idx_ecology_region (region_id),
  KEY idx_ecology_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
