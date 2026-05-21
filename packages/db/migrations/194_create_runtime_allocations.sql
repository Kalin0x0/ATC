CREATE TABLE IF NOT EXISTS atc_runtime_allocations (
  id              VARCHAR(26)   NOT NULL,
  allocation_id   VARCHAR(26)   NOT NULL,
  shard_id        VARCHAR(128)  NOT NULL,
  server_id       VARCHAR(128)  NOT NULL,
  allocation_type VARCHAR(32)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  allocation_data TEXT          NOT NULL DEFAULT '{}',
  deallocated_at  DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_allocation_id (allocation_id),
  KEY idx_allocation_shard (shard_id),
  KEY idx_allocation_server (server_id),
  KEY idx_allocation_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
