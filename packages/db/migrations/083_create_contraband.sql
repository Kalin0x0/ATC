CREATE TABLE atc_contraband (
  id                      CHAR(26)     NOT NULL,
  property_id             VARCHAR(128) NULL,
  stash_id                VARCHAR(128) NULL,
  item_name               VARCHAR(128) NOT NULL,
  quantity                INT UNSIGNED NOT NULL DEFAULT 1,
  status                  ENUM('registered','seized','destroyed') NOT NULL DEFAULT 'registered',
  registered_by_principal_id VARCHAR(128) NOT NULL,
  seized_by_principal_id  VARCHAR(128) NULL,
  seized_at               DATETIME(3)  NULL,
  registered_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_property (property_id),
  INDEX idx_status (status),
  INDEX idx_item (item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
