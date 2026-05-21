CREATE TABLE atc_ballistics (
  id                      CHAR(26)      NOT NULL,
  damage_event_id         CHAR(26)      NOT NULL,
  velocity                FLOAT         NULL,
  distance                FLOAT         NULL,
  impact_angle            FLOAT         NULL,
  penetration_data        VARCHAR(512)  NULL,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_damage_event (damage_event_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
