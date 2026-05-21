CREATE TABLE IF NOT EXISTS atc_property_runtime (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  is_online                TINYINT(1)    NOT NULL DEFAULT 0,
  occupant_count           INT           NOT NULL DEFAULT 0,
  breach_started_at        DATETIME(3)   NULL,
  breach_by_principal_id   VARCHAR(128)  NULL,
  breach_reason            VARCHAR(512)  NULL,
  last_activity_at         DATETIME(3)   NOT NULL,
  created_at               DATETIME(3)   NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_property  (property_id),
  INDEX idx_rt_online        (is_online),
  INDEX idx_rt_activity      (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_property_occupants (
  id             CHAR(26)      NOT NULL,
  property_id    CHAR(26)      NOT NULL,
  principal_id   VARCHAR(128)  NOT NULL,
  entered_at     DATETIME(3)   NOT NULL,
  exited_at      DATETIME(3)   NULL,

  PRIMARY KEY (id),
  INDEX idx_occ_property_active   (property_id, exited_at),
  INDEX idx_occ_principal         (principal_id, exited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
