CREATE TABLE atc_criminal_operations (
  id                      CHAR(26)     NOT NULL,
  label                   VARCHAR(255) NOT NULL,
  operation_type          ENUM('heist','drug_run','smuggling','extortion','assassination','theft','other') NOT NULL,
  owner_principal_id      VARCHAR(128) NOT NULL,
  gang_id                 CHAR(26)     NULL,
  status                  ENUM('planning','active','completed','failed','aborted') NOT NULL DEFAULT 'planning',
  started_at              DATETIME(3)  NULL,
  ended_at                DATETIME(3)  NULL,
  outcome                 VARCHAR(512) NULL,
  metadata                JSON         NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_owner (owner_principal_id),
  INDEX idx_gang (gang_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
