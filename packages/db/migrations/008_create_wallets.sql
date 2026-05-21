CREATE TABLE IF NOT EXISTS atc_wallets (
  id              CHAR(26)                              NOT NULL,
  character_id    CHAR(26)                              NOT NULL,
  currency        VARCHAR(8)                            NOT NULL DEFAULT 'ATC',
  cash_balance    BIGINT UNSIGNED                       NOT NULL DEFAULT 0,
  bank_balance    BIGINT UNSIGNED                       NOT NULL DEFAULT 0,
  status          ENUM('active','frozen','closed')      NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallets_character_currency (character_id, currency),
  KEY idx_wallets_character (character_id),
  KEY idx_wallets_status (status),
  CONSTRAINT fk_wallets_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
