CREATE TABLE IF NOT EXISTS atc_property_access (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  principal_id             VARCHAR(128)  NOT NULL,
  access_type              ENUM('owner','co_owner','tenant','guest','organization',
                                'emergency_ems','emergency_law')
                                         NOT NULL,
  granted_by_principal_id  VARCHAR(128)  NOT NULL,
  expires_at               DATETIME(3)   NULL,
  revoked_at               DATETIME(3)   NULL,
  revoked_by_principal_id  VARCHAR(128)  NULL,
  granted_at               DATETIME(3)   NOT NULL,

  PRIMARY KEY (id),
  INDEX idx_pa_property           (property_id),
  INDEX idx_pa_principal          (principal_id),
  INDEX idx_pa_active             (property_id, revoked_at),
  INDEX idx_pa_principal_active   (principal_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_property_keys (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  issued_to_principal_id   VARCHAR(128)  NOT NULL,
  issued_by_principal_id   VARCHAR(128)  NOT NULL,
  issued_at                DATETIME(3)   NOT NULL,
  revoked_at               DATETIME(3)   NULL,
  revoked_by_principal_id  VARCHAR(128)  NULL,

  PRIMARY KEY (id),
  INDEX idx_pk_property           (property_id),
  INDEX idx_pk_principal          (issued_to_principal_id),
  INDEX idx_pk_active             (property_id, issued_to_principal_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
