CREATE TABLE IF NOT EXISTS atc_characters (
  id              CHAR(26)                              NOT NULL,
  account_id      CHAR(26)                              NOT NULL,
  slot            TINYINT UNSIGNED                      NOT NULL,
  first_name      VARCHAR(64)                           NOT NULL,
  last_name       VARCHAR(64)                           NOT NULL,
  date_of_birth   DATE                                  NULL,
  gender          ENUM('male', 'female', 'other')       NOT NULL DEFAULT 'other',
  nationality     VARCHAR(64)                           NULL,
  metadata        JSON                                  NULL,
  status          ENUM('active', 'deleted', 'suspended') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_characters_account_slot (account_id, slot),
  KEY idx_characters_account (account_id),
  KEY idx_characters_status (status),
  KEY idx_characters_name (first_name, last_name),
  CONSTRAINT fk_characters_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
