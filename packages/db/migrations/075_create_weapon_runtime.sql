CREATE TABLE atc_weapon_runtime (
  id                      CHAR(26)      NOT NULL,
  weapon_id               CHAR(26)      NOT NULL,
  holder_principal_id     VARCHAR(128)  NOT NULL,
  is_equipped             TINYINT(1)    NOT NULL DEFAULT 0,
  current_ammo            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_ammo                SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  attachment_state        JSON          NULL,
  equipped_at             DATETIME(3)   NULL,
  unequipped_at           DATETIME(3)   NULL,
  last_sync_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_weapon_holder (weapon_id, holder_principal_id),
  INDEX idx_holder (holder_principal_id),
  INDEX idx_equipped (is_equipped)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
