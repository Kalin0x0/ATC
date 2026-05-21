CREATE TABLE atc_combat_sessions (
  id                      CHAR(26)      NOT NULL,
  initiator_principal_id  VARCHAR(128)  NOT NULL,
  status                  ENUM('active','ended','abandoned') NOT NULL DEFAULT 'active',
  outcome                 VARCHAR(256)  NULL,
  started_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at                DATETIME(3)   NULL,
  participant_count       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_initiator (initiator_principal_id),
  INDEX idx_status (status),
  INDEX idx_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
