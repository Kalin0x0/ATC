CREATE TABLE IF NOT EXISTS atc_factions (
  id                   VARCHAR(26)   NOT NULL,
  name                 VARCHAR(128)  NOT NULL,
  tag                  VARCHAR(8)    NOT NULL,
  leader_principal_id  VARCHAR(26)   NOT NULL,
  faction_type         ENUM('gang','police','military','government','civilian','other') NOT NULL DEFAULT 'gang',
  status               ENUM('active','disbanded','suspended') NOT NULL DEFAULT 'active',
  member_count         INT UNSIGNED  NOT NULL DEFAULT 1,
  color_hex            CHAR(7)       NULL,
  description          TEXT          NULL,
  territory_count      INT UNSIGNED  NOT NULL DEFAULT 0,
  created_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_faction_tag (tag),
  UNIQUE KEY uq_faction_name (name),
  INDEX idx_faction_type_status (faction_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
