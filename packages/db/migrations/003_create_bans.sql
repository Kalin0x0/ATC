CREATE TABLE IF NOT EXISTS atc_bans (
  id          CHAR(26)        NOT NULL,
  account_id  CHAR(26)        NOT NULL,
  reason      TEXT            NULL,
  expires_at  DATETIME(3)     NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  banned_by   CHAR(26)        NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_bans_account (account_id),
  KEY idx_bans_active (is_active, expires_at),
  CONSTRAINT fk_bans_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
