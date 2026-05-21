CREATE TABLE IF NOT EXISTS atc_diplomatic_relations (
  id              VARCHAR(26)   NOT NULL,
  faction_a_id    VARCHAR(128)  NOT NULL,
  faction_b_id    VARCHAR(128)  NOT NULL,
  relation_status VARCHAR(32)   NOT NULL DEFAULT 'neutral',
  relation_score  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  last_updated_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_diplomatic_factions (faction_a_id, faction_b_id),
  KEY idx_diplomatic_faction_a (faction_a_id),
  KEY idx_diplomatic_faction_b (faction_b_id),
  KEY idx_diplomatic_status (relation_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
