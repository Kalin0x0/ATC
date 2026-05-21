CREATE TABLE IF NOT EXISTS atc_property_garages (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  garage_id                VARCHAR(128)  NOT NULL,
  label                    VARCHAR(255)  NOT NULL DEFAULT '',
  capacity                 INT           NOT NULL DEFAULT 4,
  linked_by_principal_id   VARCHAR(128)  NOT NULL,
  linked_at                DATETIME(3)   NOT NULL,
  unlinked_at              DATETIME(3)   NULL,
  unlinked_by_principal_id VARCHAR(128)  NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_prop_garage  (property_id, garage_id, unlinked_at),
  INDEX idx_pg_property      (property_id),
  INDEX idx_pg_garage        (garage_id),
  INDEX idx_pg_active        (property_id, unlinked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
