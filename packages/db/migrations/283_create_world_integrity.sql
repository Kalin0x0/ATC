CREATE TABLE IF NOT EXISTS atc_world_integrity (
  id               VARCHAR(26)  NOT NULL,
  integrity_id     VARCHAR(26)  NOT NULL,
  integrity_type   ENUM('checkpoint','snapshot','hash_verify','state_audit','consistency_check','custom') NOT NULL,
  status           ENUM('pending','active','verified','failed','corrupted') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  integrity_nonce  VARCHAR(128) NOT NULL,
  world_hash       VARCHAR(128) NULL,
  integrity_data   JSON         NOT NULL,
  verified_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_integrity_id (integrity_id),
  UNIQUE KEY uq_integrity_nonce (integrity_nonce, owner_server_id),
  KEY idx_integrity_status (status),
  KEY idx_integrity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
