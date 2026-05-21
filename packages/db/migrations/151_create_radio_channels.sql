CREATE TABLE IF NOT EXISTS atc_radio_channels (
  id                  VARCHAR(26)    NOT NULL,
  channel_id          VARCHAR(128)   NOT NULL,
  channel_name        VARCHAR(255)   NOT NULL,
  channel_type        VARCHAR(64)    NOT NULL DEFAULT 'open',
  frequency           DECIMAL(8,3)   NOT NULL,
  status              VARCHAR(32)    NOT NULL DEFAULT 'active',
  owner_principal_id  VARCHAR(128)   NULL,
  is_encrypted        TINYINT(1)     NOT NULL DEFAULT 0,
  max_members         INT            NULL,
  created_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_channel_id (channel_id),
  INDEX idx_channel_type (channel_type),
  INDEX idx_channel_status (status),
  INDEX idx_channel_owner (owner_principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
