CREATE TABLE IF NOT EXISTS atc_production_freeze (
  id               CHAR(26)     NOT NULL,
  freeze_id        VARCHAR(128) NOT NULL,
  freeze_type      VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  freeze_data      JSON,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_freeze_id (freeze_id),
  KEY idx_production_freeze_status (status),
  KEY idx_production_freeze_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
