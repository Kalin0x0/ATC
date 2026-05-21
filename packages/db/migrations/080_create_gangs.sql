CREATE TABLE atc_gangs (
  id                      CHAR(26)     NOT NULL,
  name                    VARCHAR(64)  NOT NULL,
  tag                     VARCHAR(8)   NOT NULL,
  leader_principal_id     VARCHAR(128) NOT NULL,
  territory_id            VARCHAR(128) NULL,
  status                  ENUM('active','disbanded','suspended') NOT NULL DEFAULT 'active',
  member_count            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tag (tag),
  INDEX idx_leader (leader_principal_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
