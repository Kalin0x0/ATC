CREATE TABLE IF NOT EXISTS atc_federation_ownership (
  id               VARCHAR(26)  NOT NULL,
  ownership_id     VARCHAR(26)  NOT NULL,
  entity_id        VARCHAR(128) NOT NULL,
  owner_cluster_id VARCHAR(128) NOT NULL,
  ownership_type   ENUM('exclusive','shared','leased','delegated','custom') NOT NULL,
  status           ENUM('active','transferred','released') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  ownership_data   JSON         NOT NULL,
  claimed_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_federation_ownership_entity (entity_id),
  KEY idx_federation_ownership_status (status),
  KEY idx_federation_ownership_cluster (owner_cluster_id),
  KEY idx_federation_ownership_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
