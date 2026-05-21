-- Phase 23 — Jobs: work sessions (clock-in / clock-out)
CREATE TABLE IF NOT EXISTS atc_work_sessions (
  id               CHAR(26)    NOT NULL,
  contract_id      CHAR(26)    NOT NULL,
  character_id     CHAR(26)    NOT NULL,
  job_id           CHAR(26)    NOT NULL,
  clocked_in_at    DATETIME(3) NOT NULL,
  clocked_out_at   DATETIME(3) NULL,
  duration_seconds INT         NULL COMMENT 'Computed on clock-out; NULL while session is active',
  location_json    JSON        NULL COMMENT 'Optional location metadata provided by the server',
  verified_by      CHAR(26)    NULL COMMENT 'Principal or system that verified this session',
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sessions_contract   (contract_id),
  KEY idx_sessions_character  (character_id),
  KEY idx_sessions_status     (status),
  KEY idx_sessions_clocked_in (clocked_in_at),
  CONSTRAINT chk_sessions_status   CHECK (status IN ('active','completed','abandoned')),
  CONSTRAINT chk_sessions_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
