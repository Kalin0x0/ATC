CREATE TABLE IF NOT EXISTS atc_property_stashes (
  id               CHAR(26)     NOT NULL,
  property_id      CHAR(26)     NOT NULL,
  stash_id         VARCHAR(128) NOT NULL,
  label            VARCHAR(255) NOT NULL,
  stash_type       ENUM('personal','shared','evidence','medical','organization')
                                NOT NULL DEFAULT 'personal',
  owner_id         VARCHAR(128) NULL,
  organization_id  VARCHAR(128) NULL,
  capacity         INT          NOT NULL DEFAULT 50,
  is_locked        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(3)  NOT NULL,
  updated_at       DATETIME(3)  NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_stash_id      (property_id, stash_id),
  INDEX idx_stash_property    (property_id),
  INDEX idx_stash_owner       (owner_id),
  INDEX idx_stash_org         (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_property_stash_items (
  id                      CHAR(26)      NOT NULL,
  stash_record_id         CHAR(26)      NOT NULL,
  item_name               VARCHAR(128)  NOT NULL,
  quantity                INT           NOT NULL DEFAULT 1,
  metadata                JSON          NULL,
  added_by_principal_id   VARCHAR(128)  NOT NULL,
  added_at                DATETIME(3)   NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_stash_item   (stash_record_id, item_name),
  INDEX idx_si_stash         (stash_record_id),
  CONSTRAINT fk_si_stash FOREIGN KEY (stash_record_id)
    REFERENCES atc_property_stashes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
