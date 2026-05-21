CREATE TABLE IF NOT EXISTS atc_mission_objectives (
  id              VARCHAR(26)   NOT NULL,
  objective_id    VARCHAR(26)   NOT NULL,
  mission_id      VARCHAR(26)   NOT NULL,
  objective_type  VARCHAR(64)   NOT NULL,
  objective_name  VARCHAR(255)  NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  sequence_order  INT           NOT NULL DEFAULT 0,
  completion_data TEXT          NOT NULL DEFAULT '{}',
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_objectives_objective_id (objective_id),
  KEY idx_objectives_mission_id (mission_id),
  KEY idx_objectives_status (status),
  KEY idx_objectives_sequence (mission_id, sequence_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
