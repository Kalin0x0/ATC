CREATE TABLE IF NOT EXISTS atc_suppression_runtime (
  id                VARCHAR(26)   NOT NULL,
  entity_id         VARCHAR(128)  NOT NULL,
  suppressor_id     VARCHAR(128)  NULL,
  suppression_type  VARCHAR(64)   NOT NULL,
  suppression_level INT           NOT NULL DEFAULT 0,
  owner_server_id   VARCHAR(128)  NOT NULL,
  region_id         VARCHAR(128)  NULL,
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  expires_at        DATETIME(3)   NULL,
  last_tick_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_suppression_entity (entity_id),
  KEY idx_suppression_active (is_active),
  KEY idx_suppression_server (owner_server_id),
  KEY idx_suppression_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
