CREATE TABLE IF NOT EXISTS atc_snapshot_compression (
  id                VARCHAR(26)   NOT NULL,
  compression_id    VARCHAR(128)  NOT NULL,
  snapshot_id       VARCHAR(128)  NOT NULL,
  compression_type  VARCHAR(64)   NOT NULL,
  status            VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128)  NOT NULL,
  compression_nonce VARCHAR(128)  NOT NULL,
  compression_data  TEXT          NOT NULL DEFAULT '{}',
  started_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at      DATETIME(3)   NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_compression_nonce (compression_nonce),
  KEY idx_compression_snapshot (snapshot_id),
  KEY idx_compression_status (status),
  KEY idx_compression_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
