CREATE TABLE atc_raids (
  id                      CHAR(26)     NOT NULL,
  property_id             VARCHAR(128) NOT NULL,
  initiating_agency_id    VARCHAR(128) NULL,
  lead_principal_id       VARCHAR(128) NOT NULL,
  status                  ENUM('staging','active','completed','aborted') NOT NULL DEFAULT 'staging',
  outcome                 ENUM('success','failure','partial','aborted') NULL,
  participants            JSON         NOT NULL,
  started_at              DATETIME(3)  NULL,
  ended_at                DATETIME(3)  NULL,
  notes                   TEXT         NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_property (property_id),
  INDEX idx_lead (lead_principal_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
