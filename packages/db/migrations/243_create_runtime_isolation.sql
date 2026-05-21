CREATE TABLE IF NOT EXISTS atc_runtime_isolation (
  id              VARCHAR(26)  NOT NULL,
  isolation_id    VARCHAR(26)  NOT NULL,
  entity_id       VARCHAR(128) NOT NULL,
  isolation_type  ENUM('player','server','resource','session','custom') NOT NULL,
  status          ENUM('isolated','quarantined','released') NOT NULL DEFAULT 'isolated',
  owner_server_id VARCHAR(128) NOT NULL,
  isolation_data  JSON         NOT NULL,
  isolated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at     DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_isolation_entity (entity_id),
  KEY idx_runtime_isolation_status (status),
  KEY idx_runtime_isolation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
