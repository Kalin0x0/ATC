CREATE TABLE atc_ems_hospital_capacity (
  id              CHAR(26)     NOT NULL,
  facility_id     VARCHAR(128) NOT NULL,
  total_beds      INT          NOT NULL DEFAULT 0,
  available_beds  INT          NOT NULL DEFAULT 0,
  icu_total       INT          NOT NULL DEFAULT 0,
  icu_available   INT          NOT NULL DEFAULT 0,
  er_total        INT          NOT NULL DEFAULT 0,
  er_available    INT          NOT NULL DEFAULT 0,
  is_diversion    TINYINT(1)   NOT NULL DEFAULT 0,
  is_overflow     TINYINT(1)   NOT NULL DEFAULT 0,
  updated_at      DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hospital_facility (facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
