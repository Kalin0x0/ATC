CREATE TABLE IF NOT EXISTS atc_runtime_coordination (
  id                  VARCHAR(26)  NOT NULL,
  node_id             VARCHAR(128) NOT NULL,
  coordination_type   ENUM('leader','follower','observer','standby','custom') NOT NULL,
  status              ENUM('active','inactive','failed') NOT NULL DEFAULT 'active',
  owner_server_id     VARCHAR(128) NOT NULL,
  coordination_data   JSON         NOT NULL,
  heartbeat_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_coordination_node (node_id),
  KEY idx_coordination_type (coordination_type),
  KEY idx_coordination_status (status),
  KEY idx_coordination_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
