CREATE TABLE IF NOT EXISTS atc_resource_balancing (
  id               VARCHAR(26)  NOT NULL,
  balancing_id     VARCHAR(26)  NOT NULL,
  resource_type    ENUM('cash','goods','property','jobs','housing','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  balancing_nonce  VARCHAR(128) NOT NULL,
  target_region_id VARCHAR(128) NULL,
  balancing_data   JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_resource_balancing_id (balancing_id),
  UNIQUE KEY uq_resource_balancing_nonce (balancing_nonce, owner_server_id),
  KEY idx_resource_balancing_status (status),
  KEY idx_resource_balancing_region (target_region_id),
  KEY idx_resource_balancing_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
