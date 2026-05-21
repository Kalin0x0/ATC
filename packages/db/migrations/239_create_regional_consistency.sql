CREATE TABLE IF NOT EXISTS atc_regional_consistency (
  id              VARCHAR(26)  NOT NULL,
  check_id        VARCHAR(26)  NOT NULL,
  region_id       VARCHAR(128) NOT NULL,
  check_type      ENUM('hash','count','timestamp','full','custom') NOT NULL,
  status          ENUM('pending','passed','failed','skipped') NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  check_nonce     VARCHAR(128) NOT NULL,
  completed_at    DATETIME(3)  NULL,
  check_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_regional_consistency_check_id (check_id),
  UNIQUE KEY uq_regional_consistency_nonce (check_nonce, owner_server_id),
  KEY idx_regional_consistency_region (region_id),
  KEY idx_regional_consistency_status (status),
  KEY idx_regional_consistency_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
