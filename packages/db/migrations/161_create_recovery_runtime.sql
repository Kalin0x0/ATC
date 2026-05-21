CREATE TABLE IF NOT EXISTS atc_recovery_runtime (
  id                       VARCHAR(26)    NOT NULL,
  disaster_id              VARCHAR(128)   NOT NULL,
  recovery_phase           VARCHAR(64)    NOT NULL DEFAULT 'initial',
  progress_percent         DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  estimated_completion_at  DATETIME(3)    NULL,
  completed_at             DATETIME(3)    NULL,
  created_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_recovery_disaster (disaster_id),
  INDEX idx_recovery_phase (recovery_phase),
  INDEX idx_recovery_progress (progress_percent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
