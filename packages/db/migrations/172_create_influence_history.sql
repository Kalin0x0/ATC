CREATE TABLE IF NOT EXISTS atc_influence_history (
  id             VARCHAR(26)   NOT NULL,
  principal_id   VARCHAR(128)  NOT NULL,
  faction_id     VARCHAR(128)  NULL,
  change_amount  DECIMAL(10,2) NOT NULL,
  change_reason  VARCHAR(255)  NOT NULL,
  change_type    VARCHAR(32)   NOT NULL,
  actor_id       VARCHAR(128)  NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_influence_principal (principal_id),
  KEY idx_influence_faction (faction_id),
  KEY idx_influence_created (created_at),
  KEY idx_influence_type (change_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
