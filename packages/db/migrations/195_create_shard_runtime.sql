CREATE TABLE IF NOT EXISTS atc_shard_runtime (
  id              VARCHAR(26)   NOT NULL,
  shard_id        VARCHAR(128)  NOT NULL,
  shard_type      VARCHAR(32)   NOT NULL,
  region_id       VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  capacity_limit  INT           NULL,
  current_load    INT           NOT NULL DEFAULT 0,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  transferred_at  DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_shard_id (shard_id),
  KEY idx_shard_runtime_server (owner_server_id),
  KEY idx_shard_runtime_region (region_id),
  KEY idx_shard_runtime_active (is_active),
  KEY idx_shard_runtime_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
