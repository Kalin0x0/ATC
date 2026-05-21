CREATE TABLE atc_gang_members (
  id                      CHAR(26)     NOT NULL,
  gang_id                 CHAR(26)     NOT NULL,
  principal_id            VARCHAR(128) NOT NULL,
  rank                    ENUM('leader','officer','member','associate') NOT NULL DEFAULT 'associate',
  invited_by_principal_id VARCHAR(128) NULL,
  joined_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at                 DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_active_member (gang_id, principal_id, left_at),
  INDEX idx_gang (gang_id),
  INDEX idx_principal (principal_id),
  INDEX idx_active (gang_id, left_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
