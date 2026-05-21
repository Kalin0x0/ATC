CREATE TABLE IF NOT EXISTS atc_meta_runtime (
  id               VARCHAR(26)  NOT NULL,
  meta_id          VARCHAR(26)  NOT NULL,
  meta_type        ENUM('orchestrator','scheduler','balancer','watchdog','coordinator','custom') NOT NULL,
  status           ENUM('active','paused','terminated','degraded') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  meta_nonce       VARCHAR(128) NOT NULL,
  meta_data        JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_meta_id (meta_id),
  UNIQUE KEY uq_meta_nonce (meta_nonce, owner_server_id),
  KEY idx_meta_status (status),
  KEY idx_meta_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
