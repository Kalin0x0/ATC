CREATE TABLE IF NOT EXISTS atc_runtime_tuning (
  id              VARCHAR(26)  NOT NULL,
  entity_id       VARCHAR(128) NOT NULL,
  tuning_type     ENUM('threshold','interval','capacity','priority','weight','custom') NOT NULL,
  status          ENUM('active','inactive','superseded') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  tuning_data     JSON         NOT NULL,
  applied_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tuning_entity (entity_id),
  KEY idx_tuning_status (status),
  KEY idx_tuning_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
