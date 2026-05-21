CREATE TABLE IF NOT EXISTS atc_properties (
  id                    CHAR(26)       NOT NULL,
  owner_id              VARCHAR(128)   NULL,
  organization_id       VARCHAR(128)   NULL,
  name                  VARCHAR(255)   NOT NULL,
  address               VARCHAR(512)   NOT NULL,
  interior_type         VARCHAR(128)   NOT NULL,
  shell_id              VARCHAR(128)   NULL,
  status                ENUM('available','owned','occupied','locked','breached','seized','abandoned')
                                       NOT NULL DEFAULT 'available',
  is_locked             TINYINT(1)     NOT NULL DEFAULT 0,
  alarm_state           ENUM('off','armed','triggered')
                                       NOT NULL DEFAULT 'off',
  storage_capacity      INT            NOT NULL DEFAULT 100,
  notes                 TEXT           NULL,
  seized_by_principal_id VARCHAR(128)  NULL,
  seized_at             DATETIME(3)    NULL,
  created_at            DATETIME(3)    NOT NULL,
  updated_at            DATETIME(3)    NOT NULL,

  PRIMARY KEY (id),
  INDEX idx_prop_owner        (owner_id),
  INDEX idx_prop_org          (organization_id),
  INDEX idx_prop_status       (status),
  INDEX idx_prop_interior_type (interior_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
