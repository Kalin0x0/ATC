CREATE TABLE IF NOT EXISTS atc_distributed_optimization (
  id                 VARCHAR(26)  NOT NULL,
  node_id            VARCHAR(128) NOT NULL,
  opt_type           ENUM('load_balance','shard_rebalance','cache_warm','route_optimize','custom') NOT NULL,
  status             ENUM('active','idle','overloaded','failed') NOT NULL DEFAULT 'active',
  owner_server_id    VARCHAR(128) NOT NULL,
  opt_data           JSON         NOT NULL,
  last_optimized_at  DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_dist_opt_node (node_id),
  KEY idx_dist_opt_status (status),
  KEY idx_dist_opt_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
