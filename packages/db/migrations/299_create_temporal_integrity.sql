CREATE TABLE IF NOT EXISTS atc_temporal_integrity (
  id               CHAR(26)     NOT NULL,
  integrity_id     CHAR(26)     NOT NULL,
  integrity_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'unknown',
  owner_server_id  VARCHAR(128) NOT NULL,
  integrity_nonce  VARCHAR(128) NOT NULL,
  integrity_data   JSON         NULL,
  repaired_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_temporal_integrity_id (integrity_id),
  UNIQUE KEY uq_temporal_integrity_nonce (integrity_nonce, owner_server_id),
  INDEX idx_temporal_integrity_status (status),
  INDEX idx_temporal_integrity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
