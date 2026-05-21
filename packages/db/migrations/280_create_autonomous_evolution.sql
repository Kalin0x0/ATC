CREATE TABLE IF NOT EXISTS atc_autonomous_evolution (
  id               VARCHAR(26)  NOT NULL,
  autonomous_id    VARCHAR(26)  NOT NULL,
  autonomous_type  ENUM('self_heal','self_tune','self_scale','self_optimize','custom') NOT NULL,
  status           ENUM('triggered','applying','applied','failed','reverted') NOT NULL DEFAULT 'triggered',
  owner_server_id  VARCHAR(128) NOT NULL,
  autonomous_nonce VARCHAR(128) NOT NULL,
  trigger_data     JSON         NOT NULL,
  outcome_data     JSON         NULL,
  applied_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_autonomous_id (autonomous_id),
  UNIQUE KEY uq_autonomous_nonce (autonomous_nonce, owner_server_id),
  KEY idx_autonomous_status (status),
  KEY idx_autonomous_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
