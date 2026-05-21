CREATE TABLE IF NOT EXISTS atc_runtime_evolution (
  id              VARCHAR(26)  NOT NULL,
  evolution_id    VARCHAR(26)  NOT NULL,
  evolution_type  ENUM('schema','behavior','protocol','topology','config','custom') NOT NULL,
  status          ENUM('pending','active','completed','failed','rolled_back') NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  evolution_nonce VARCHAR(128) NOT NULL,
  evolution_data  JSON         NOT NULL,
  completed_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_evolution_id (evolution_id),
  UNIQUE KEY uq_evolution_nonce (evolution_nonce, owner_server_id),
  KEY idx_evolution_status (status),
  KEY idx_evolution_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
