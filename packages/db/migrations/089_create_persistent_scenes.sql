CREATE TABLE atc_persistent_scenes (
  id                      CHAR(26)     NOT NULL,
  scene_id                VARCHAR(128) NOT NULL,
  scene_type              ENUM('crime_scene','accident','blockade','event','construction','other') NOT NULL,
  world_region            VARCHAR(128) NULL,
  data                    JSON         NOT NULL,
  persisted_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at              DATETIME(3)  NULL,
  restored_at             DATETIME(3)  NULL,
  PRIMARY KEY (id),
  INDEX idx_scene_id (scene_id),
  INDEX idx_type (scene_type),
  INDEX idx_expires (expires_at),
  INDEX idx_region (world_region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
