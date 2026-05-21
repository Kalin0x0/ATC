CREATE TABLE IF NOT EXISTS atc_ai_reinforcements (
  id                    VARCHAR(26)   NOT NULL,
  reinforcement_id      VARCHAR(26)   NOT NULL,
  reinforcement_nonce   VARCHAR(128)  NOT NULL,
  requesting_entity_id  VARCHAR(128)  NULL,
  reinforcement_type    VARCHAR(64)   NOT NULL,
  status                VARCHAR(32)   NOT NULL DEFAULT 'requested',
  quantity              INT           NOT NULL DEFAULT 1,
  owner_server_id       VARCHAR(128)  NULL,
  dispatched_at         DATETIME(3)   NULL,
  arrived_at            DATETIME(3)   NULL,
  created_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_reinforcements_id (reinforcement_id),
  UNIQUE KEY uq_ai_reinforcements_nonce (reinforcement_nonce),
  KEY idx_ai_reinforcements_status (status),
  KEY idx_ai_reinforcements_entity (requesting_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
