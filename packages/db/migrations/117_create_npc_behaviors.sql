CREATE TABLE IF NOT EXISTS atc_npc_behaviors (
  id          VARCHAR(26)    NOT NULL,
  npc_id      VARCHAR(26)    NOT NULL,
  behavior    VARCHAR(128)   NOT NULL,
  params      JSON           NULL,
  started_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at    DATETIME(3)    NULL,
  created_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_npc_behavior_npc (npc_id),
  INDEX idx_npc_behavior_active (npc_id, ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
