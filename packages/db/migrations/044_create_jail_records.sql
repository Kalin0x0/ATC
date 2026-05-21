-- Phase 24 — Government: jail/custody state (server-authoritative, append-safe)
CREATE TABLE IF NOT EXISTS atc_jail_records (
  id                       CHAR(26)    NOT NULL,
  character_id             CHAR(26)    NOT NULL,
  arrest_record_id         CHAR(26)    NOT NULL,
  start_at                 DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  release_at               DATETIME(3) NULL,
  released_by_principal_id CHAR(26)    NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_jail_char   (character_id),
  KEY idx_jail_arrest (arrest_record_id),
  KEY idx_jail_status (status),
  CONSTRAINT chk_jail_status CHECK (status IN ('active','released')),
  CONSTRAINT fk_jail_arrest  FOREIGN KEY (arrest_record_id) REFERENCES atc_arrest_records (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
