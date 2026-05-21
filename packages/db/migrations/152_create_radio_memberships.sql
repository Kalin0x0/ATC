CREATE TABLE IF NOT EXISTS atc_radio_memberships (
  id           VARCHAR(26)    NOT NULL,
  channel_id   VARCHAR(128)   NOT NULL,
  principal_id VARCHAR(128)   NOT NULL,
  role         VARCHAR(32)    NOT NULL DEFAULT 'listener',
  joined_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_membership (channel_id, principal_id),
  INDEX idx_membership_channel (channel_id),
  INDEX idx_membership_principal (principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
