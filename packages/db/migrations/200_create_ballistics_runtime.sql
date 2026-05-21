CREATE TABLE IF NOT EXISTS atc_ballistics_runtime (
  id                VARCHAR(26)   NOT NULL,
  session_id        VARCHAR(128)  NOT NULL,
  entity_id         VARCHAR(128)  NOT NULL,
  ballistic_type    VARCHAR(64)   NOT NULL,
  trajectory_data   TEXT          NOT NULL DEFAULT '{}',
  impact_data       TEXT          NOT NULL DEFAULT '{}',
  velocity          FLOAT         NOT NULL DEFAULT 0,
  penetration_depth FLOAT         NOT NULL DEFAULT 0,
  owner_server_id   VARCHAR(128)  NOT NULL,
  is_resolved       TINYINT(1)    NOT NULL DEFAULT 0,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ballistics_session (session_id),
  KEY idx_ballistics_entity (entity_id),
  KEY idx_ballistics_resolved (is_resolved),
  KEY idx_ballistics_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
