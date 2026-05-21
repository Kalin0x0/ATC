CREATE TABLE IF NOT EXISTS atc_production_readiness (
  id                       CHAR(26)     NOT NULL,
  readiness_checkpoint_id  VARCHAR(128) NOT NULL,
  checkpoint_type          VARCHAR(32)  NOT NULL,
  status                   VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id          VARCHAR(128) NOT NULL,
  checkpoint_data          JSON         NULL,
  synced_at                DATETIME(3)  NOT NULL DEFAULT NOW(3),
  confirmed_at             DATETIME(3)  NULL,
  created_at               DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_readiness_id (readiness_checkpoint_id),
  INDEX idx_production_readiness_status (status),
  INDEX idx_production_readiness_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
