-- Phase 22 — Commerce: shop item listings
-- UNIQUE(shop_id, item_id) prevents duplicate listings per shop.
-- stock = -1 means unlimited.
-- sell_price NULL means the shop does not buy this item from players.
CREATE TABLE IF NOT EXISTS atc_shop_items (
  id            CHAR(26)        NOT NULL,
  shop_id       CHAR(26)        NOT NULL,
  item_id       VARCHAR(64)     NOT NULL,
  stock         INT             NOT NULL DEFAULT -1  COMMENT '-1 = unlimited',
  price         DECIMAL(20,4)   NOT NULL,
  sell_price    DECIMAL(20,4)   NULL     COMMENT 'Price shop pays player; NULL = not buyable by shop',
  currency      VARCHAR(16)     NOT NULL DEFAULT 'USD',
  min_level     SMALLINT UNSIGNED NULL,
  metadata_json JSON            NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_item (shop_id, item_id),
  KEY idx_shop_items_shop  (shop_id),
  KEY idx_shop_items_item  (item_id),
  CONSTRAINT fk_shop_items_shop FOREIGN KEY (shop_id) REFERENCES atc_shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_items_item FOREIGN KEY (item_id) REFERENCES atc_item_definitions(id),
  CONSTRAINT chk_shop_items_stock      CHECK (stock >= -1),
  CONSTRAINT chk_shop_items_price      CHECK (price > 0),
  CONSTRAINT chk_shop_items_sell_price CHECK (sell_price IS NULL OR sell_price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
