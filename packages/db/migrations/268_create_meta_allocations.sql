CREATE TABLE IF NOT EXISTS atc_meta_allocations (
  id               VARCHAR(26)  NOT NULL,
  entity_id        VARCHAR(128) NOT NULL,
  allocation_type  ENUM('compute','memory','network','storage','process','custom') NOT NULL,
  status           ENUM('allocated','released','overloaded','reserved') NOT NULL DEFAULT 'allocated',
  owner_server_id  VARCHAR(128) NOT NULL,
  allocation_data  JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_meta_allocation_entity (entity_id),
  KEY idx_meta_allocation_type (allocation_type),
  KEY idx_meta_allocation_status (status),
  KEY idx_meta_allocation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
