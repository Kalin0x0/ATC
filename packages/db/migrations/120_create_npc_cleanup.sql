CREATE TABLE IF NOT EXISTS atc_npc_cleanup (
  id               VARCHAR(26)    NOT NULL,
  npc_id           VARCHAR(26)    NOT NULL,
  cleanup_reason   VARCHAR(128)   NOT NULL,
  owner_server_id  VARCHAR(128)   NULL,
  cleaned_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_npc_cleanup_npc (npc_id),
  INDEX idx_npc_cleanup_cleaned_at (cleaned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
