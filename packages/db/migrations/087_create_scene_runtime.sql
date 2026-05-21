CREATE TABLE atc_scene_runtime (
  id                      CHAR(26)     NOT NULL,
  scene_id                VARCHAR(128) NOT NULL,
  creator_principal_id    VARCHAR(128) NOT NULL,
  label                   VARCHAR(255) NOT NULL,
  is_locked               TINYINT(1)   NOT NULL DEFAULT 0,
  status                  ENUM('active','suspended','destroyed','cleanup_pending') NOT NULL DEFAULT 'active',
  replication_node        VARCHAR(128) NULL,
  entity_count            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_scene_id (scene_id),
  INDEX idx_creator (creator_principal_id),
  INDEX idx_status (status),
  INDEX idx_node (replication_node)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
