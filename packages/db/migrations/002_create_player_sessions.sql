CREATE TABLE IF NOT EXISTS atc_player_sessions (
  id                  CHAR(26)        NOT NULL,
  account_id          CHAR(26)        NOT NULL,
  source              INT UNSIGNED    NOT NULL,
  name                VARCHAR(256)    NOT NULL,
  primary_identifier  VARCHAR(128)    NOT NULL,
  language            VARCHAR(8)      NOT NULL DEFAULT 'en',
  state               ENUM('connecting', 'active', 'ended') NOT NULL DEFAULT 'connecting',
  connected_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  disconnected_at     DATETIME(3)     NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_source (source),
  KEY idx_sessions_account (account_id),
  KEY idx_sessions_state (state),
  CONSTRAINT fk_sessions_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
