CREATE TABLE atc_injury_runtime (
  id                      CHAR(26)      NOT NULL,
  principal_id            VARCHAR(128)  NOT NULL,
  body_region             ENUM('head','chest','abdomen','left_arm','right_arm','left_leg','right_leg','back','unknown') NOT NULL,
  severity                ENUM('minor','moderate','severe','critical','fatal') NOT NULL,
  source_damage_event_id  CHAR(26)      NULL,
  applied_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at             DATETIME(3)   NULL,
  PRIMARY KEY (id),
  INDEX idx_principal (principal_id),
  INDEX idx_active (principal_id, resolved_at),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
