CREATE TABLE IF NOT EXISTS atc_environmental_evolution (
  id               VARCHAR(26)  NOT NULL,
  evolution_id     VARCHAR(26)  NOT NULL,
  evolution_type   ENUM('climate_shift','biome_change','species_migration','pollution','restoration','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  region_id        VARCHAR(128) NULL,
  evolution_nonce  VARCHAR(128) NOT NULL,
  evolution_data   JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_evolution_id (evolution_id),
  UNIQUE KEY uq_evolution_nonce (evolution_nonce, owner_server_id),
  KEY idx_evolution_status (status),
  KEY idx_evolution_region (region_id),
  KEY idx_evolution_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
