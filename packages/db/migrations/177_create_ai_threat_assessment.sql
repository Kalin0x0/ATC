CREATE TABLE IF NOT EXISTS atc_ai_threat_assessment (
  id               VARCHAR(26)   NOT NULL,
  assessment_id    VARCHAR(26)   NOT NULL,
  entity_id        VARCHAR(128)  NOT NULL,
  threat_source_id VARCHAR(128)  NULL,
  threat_level     VARCHAR(32)   NOT NULL DEFAULT 'low',
  threat_type      VARCHAR(32)   NOT NULL,
  assessment_data  TEXT          NOT NULL DEFAULT '{}',
  expires_at       DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_threat_assessment_id (assessment_id),
  KEY idx_ai_threat_entity (entity_id),
  KEY idx_ai_threat_level (threat_level),
  KEY idx_ai_threat_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
