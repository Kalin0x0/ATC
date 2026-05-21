CREATE TABLE IF NOT EXISTS atc_final_validation (
  id                CHAR(26)     NOT NULL,
  validation_id     CHAR(26)     NOT NULL,
  validation_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  validation_nonce  VARCHAR(128) NOT NULL,
  validation_data   JSON,
  validated_at      DATETIME(3),
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_final_validation_nonce (validation_nonce, owner_server_id),
  KEY idx_final_validation_status (status),
  KEY idx_final_validation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
