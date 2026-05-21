CREATE TABLE IF NOT EXISTS atc_encrypted_channels (
  id                   VARCHAR(26)    NOT NULL,
  channel_id           VARCHAR(128)   NOT NULL,
  encryption_key_hash  VARCHAR(255)   NOT NULL,
  key_rotated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_enc_channel_id (channel_id),
  INDEX idx_enc_key_rotated (key_rotated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
