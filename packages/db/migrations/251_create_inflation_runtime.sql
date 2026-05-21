CREATE TABLE IF NOT EXISTS atc_inflation_runtime (
  id              VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NOT NULL,
  inflation_rate  DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  status          ENUM('stable','inflationary','deflationary','hyperinflationary') NOT NULL DEFAULT 'stable',
  owner_server_id VARCHAR(128)  NOT NULL,
  inflation_data  JSON          NOT NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  measured_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_inflation_runtime_region (region_id),
  KEY idx_inflation_runtime_status (status),
  KEY idx_inflation_runtime_active (is_active),
  KEY idx_inflation_runtime_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
