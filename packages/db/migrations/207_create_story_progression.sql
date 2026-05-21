CREATE TABLE IF NOT EXISTS atc_story_progression (
  id               VARCHAR(26)   NOT NULL,
  entity_id        VARCHAR(128)  NOT NULL,
  campaign_id      VARCHAR(128)  NULL,
  progression_type VARCHAR(64)   NOT NULL,
  stage_key        VARCHAR(256)  NOT NULL,
  progression_data TEXT          NOT NULL DEFAULT '{}',
  owner_server_id  VARCHAR(128)  NOT NULL,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_story_entity (entity_id),
  KEY idx_story_campaign (campaign_id),
  KEY idx_story_active (is_active),
  KEY idx_story_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
