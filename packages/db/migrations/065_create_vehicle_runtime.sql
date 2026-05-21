CREATE TABLE IF NOT EXISTS atc_vehicle_runtime (
  id                       CHAR(26)       NOT NULL,
  vehicle_id               CHAR(26)       NOT NULL,
  spawned_by_principal_id  VARCHAR(128)   NOT NULL,
  net_id                   INT            NULL,
  server_handle            INT            NULL,
  x                        DOUBLE         NOT NULL DEFAULT 0,
  y                        DOUBLE         NOT NULL DEFAULT 0,
  z                        DOUBLE         NOT NULL DEFAULT 0,
  heading                  FLOAT          NOT NULL DEFAULT 0,
  fuel                     TINYINT UNSIGNED NOT NULL DEFAULT 100,
  body_health              SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
  engine_health            SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
  is_locked                TINYINT(1)     NOT NULL DEFAULT 1,
  is_engine_on             TINYINT(1)     NOT NULL DEFAULT 0,
  last_heartbeat_at        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at               DATETIME(3)    NULL,
  spawned_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                          ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vrt_vehicle (vehicle_id),
  CONSTRAINT fk_vrt_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
