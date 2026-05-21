CREATE TABLE IF NOT EXISTS atc_integrity_validation (
  id               VARCHAR(26)  NOT NULL,
  validation_id    VARCHAR(26)  NOT NULL,
  validation_type  ENUM('world_state','entity_state','transaction','replication','custom') NOT NULL,
  status           ENUM('pending','passed','failed','skipped') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_id        VARCHAR(128) NULL,
  validation_nonce VARCHAR(128) NOT NULL,
  validation_data  JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_validation_id (validation_id),
  UNIQUE KEY uq_validation_nonce (validation_nonce, owner_server_id),
  KEY idx_validation_status (status),
  KEY idx_validation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
