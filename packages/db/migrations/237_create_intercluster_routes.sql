CREATE TABLE IF NOT EXISTS atc_intercluster_routes (
  id              VARCHAR(26)  NOT NULL,
  route_id        VARCHAR(26)  NOT NULL,
  source_cluster  VARCHAR(128) NOT NULL,
  target_cluster  VARCHAR(128) NOT NULL,
  route_type      ENUM('direct','relay','failover','broadcast','custom') NOT NULL,
  status          ENUM('active','inactive','failed') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  route_nonce     VARCHAR(128) NOT NULL,
  route_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_intercluster_route_id (route_id),
  UNIQUE KEY uq_intercluster_route_nonce (route_nonce, owner_server_id),
  KEY idx_intercluster_routes_status (status),
  KEY idx_intercluster_routes_clusters (source_cluster, target_cluster),
  KEY idx_intercluster_routes_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
