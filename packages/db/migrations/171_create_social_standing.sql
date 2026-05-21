CREATE TABLE IF NOT EXISTS atc_social_standing (
  id             VARCHAR(26)   NOT NULL,
  principal_id   VARCHAR(128)  NOT NULL,
  standing_score DECIMAL(10,2) NOT NULL DEFAULT 200.00,
  standing_tier  VARCHAR(32)   NOT NULL DEFAULT 'common',
  last_change_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_social_standing_principal (principal_id),
  KEY idx_social_standing_tier (standing_tier),
  KEY idx_social_standing_score (standing_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
