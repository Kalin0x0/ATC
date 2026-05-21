CREATE TABLE IF NOT EXISTS atc_wildlife_runtime (
  id               VARCHAR(26)   NOT NULL,
  zone_id          VARCHAR(128)  NOT NULL,
  wildlife_type    ENUM('predator','prey','scavenger','herbivore','marine','custom') NOT NULL,
  status           ENUM('thriving','stable','declining','endangered','extinct') NOT NULL DEFAULT 'stable',
  owner_server_id  VARCHAR(128)  NOT NULL,
  population       INT UNSIGNED  NOT NULL DEFAULT 0,
  wildlife_data    JSON          NOT NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_wildlife_zone (zone_id),
  KEY idx_wildlife_status (status),
  KEY idx_wildlife_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
