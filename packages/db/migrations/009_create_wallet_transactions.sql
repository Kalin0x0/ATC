CREATE TABLE IF NOT EXISTS atc_wallet_transactions (
  id                CHAR(26)                                      NOT NULL,
  wallet_id         CHAR(26)                                      NOT NULL,
  character_id      CHAR(26)                                      NOT NULL,
  type              ENUM('credit','debit','transfer')             NOT NULL,
  account           ENUM('cash','bank')                           NOT NULL,
  amount            BIGINT UNSIGNED                               NOT NULL,
  balance_after     BIGINT UNSIGNED                               NOT NULL,
  currency          VARCHAR(8)                                    NOT NULL DEFAULT 'ATC',
  reason            VARCHAR(128)                                  NOT NULL,
  source            ENUM('system','admin','api','gameplay')       NOT NULL DEFAULT 'system',
  idempotency_key   VARCHAR(128)                                  NOT NULL,
  metadata          JSON                                          NULL,
  created_at        DATETIME(3)                                   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_idempotency (idempotency_key),
  KEY idx_transactions_wallet (wallet_id),
  KEY idx_transactions_character (character_id),
  KEY idx_transactions_currency (currency),
  KEY idx_transactions_created (created_at),
  CONSTRAINT fk_transactions_wallet FOREIGN KEY (wallet_id)
    REFERENCES atc_wallets (id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
