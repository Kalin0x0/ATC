CREATE TABLE IF NOT EXISTS atc_cluster_continuity (
  id               CHAR(26)     NOT NULL,
  cluster_id       VARCHAR(128) NOT NULL,
  cluster_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  cluster_data     JSON         NULL,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cluster_continuity_id (cluster_id),
  INDEX idx_cluster_continuity_status (status),
  INDEX idx_cluster_continuity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
