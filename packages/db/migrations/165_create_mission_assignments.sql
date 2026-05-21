CREATE TABLE IF NOT EXISTS atc_mission_assignments (
  id             VARCHAR(26)   NOT NULL,
  assignment_id  VARCHAR(26)   NOT NULL,
  mission_id     VARCHAR(26)   NOT NULL,
  assignee_id    VARCHAR(128)  NOT NULL,
  assignee_type  VARCHAR(32)   NOT NULL DEFAULT 'player',
  role           VARCHAR(32)   NOT NULL DEFAULT 'participant',
  assigned_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at    DATETIME(3)   NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignments_id (assignment_id),
  UNIQUE KEY uq_assignments_mission_assignee (mission_id, assignee_id),
  KEY idx_assignments_assignee (assignee_id),
  KEY idx_assignments_mission (mission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
