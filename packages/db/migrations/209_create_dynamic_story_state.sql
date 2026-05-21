CREATE TABLE IF NOT EXISTS atc_dynamic_story_state (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  branch_key      VARCHAR(256)  NOT NULL,
  state_type      VARCHAR(64)   NOT NULL,
  story_data      TEXT          NOT NULL DEFAULT '{}',
  owner_server_id VARCHAR(128)  NOT NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_story_state_entity (entity_id),
  KEY idx_story_state_branch (branch_key(128)),
  KEY idx_story_state_active (is_active),
  KEY idx_story_state_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
