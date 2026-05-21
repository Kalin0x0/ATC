CREATE TABLE IF NOT EXISTS atc_armor_runtime (
  id                    VARCHAR(26)   NOT NULL,
  entity_id             VARCHAR(128)  NOT NULL,
  armor_type            VARCHAR(64)   NOT NULL,
  protection_level      INT           NOT NULL DEFAULT 0,
  penetration_threshold FLOAT         NOT NULL DEFAULT 0,
  current_integrity     FLOAT         NOT NULL DEFAULT 100,
  owner_server_id       VARCHAR(128)  NOT NULL,
  is_active             TINYINT(1)    NOT NULL DEFAULT 1,
  armor_data            TEXT          NOT NULL DEFAULT '{}',
  created_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_armor_entity (entity_id),
  KEY idx_armor_active (is_active),
  KEY idx_armor_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
