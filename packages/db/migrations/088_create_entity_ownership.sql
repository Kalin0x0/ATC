CREATE TABLE atc_entity_ownership (
  id                      CHAR(26)     NOT NULL,
  entity_id               CHAR(26)     NOT NULL,
  scene_id                VARCHAR(128) NULL,
  principal_id            VARCHAR(128) NOT NULL,
  acquired_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at             DATETIME(3)  NULL,
  PRIMARY KEY (id),
  INDEX idx_entity (entity_id),
  INDEX idx_principal (principal_id),
  INDEX idx_active (entity_id, released_at),
  INDEX idx_scene (scene_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
