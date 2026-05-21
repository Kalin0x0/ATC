CREATE TABLE IF NOT EXISTS atc_civic_influence (
  id               VARCHAR(26)     NOT NULL,
  entity_id        VARCHAR(128)    NOT NULL,
  influence_type   ENUM('political','economic','social','military','custom') NOT NULL,
  influence_score  DECIMAL(10,4)   NOT NULL DEFAULT 0.0000,
  owner_server_id  VARCHAR(128)    NOT NULL,
  region_id        VARCHAR(128)    NULL,
  influence_data   JSON            NOT NULL,
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_civic_influence_entity (entity_id),
  KEY idx_civic_influence_type (influence_type),
  KEY idx_civic_influence_region (region_id),
  KEY idx_civic_influence_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
