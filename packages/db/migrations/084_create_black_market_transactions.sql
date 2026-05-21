CREATE TABLE atc_black_market_transactions (
  id                      CHAR(26)     NOT NULL,
  seller_principal_id     VARCHAR(128) NOT NULL,
  buyer_principal_id      VARCHAR(128) NOT NULL,
  item_name               VARCHAR(128) NOT NULL,
  quantity                INT UNSIGNED NOT NULL DEFAULT 1,
  price                   INT UNSIGNED NOT NULL DEFAULT 0,
  location_label          VARCHAR(255) NULL,
  completed_at            DATETIME(3)  NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_seller (seller_principal_id),
  INDEX idx_buyer (buyer_principal_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
