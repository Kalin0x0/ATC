CREATE TABLE IF NOT EXISTS atc_protocol_bridges (
  id               VARCHAR(26)  NOT NULL,
  bridge_id        VARCHAR(128) NOT NULL,
  bridge_type      ENUM('grpc','http','websocket','tcp','custom') NOT NULL,
  status           ENUM('active','inactive','failed','draining') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  remote_server_id VARCHAR(128) NOT NULL,
  bridge_data      JSON         NOT NULL,
  heartbeat_at     DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bridge_id (bridge_id),
  KEY idx_bridge_status (status),
  KEY idx_bridge_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
