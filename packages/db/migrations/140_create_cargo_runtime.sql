CREATE TABLE IF NOT EXISTS atc_cargo_runtime (
  id           VARCHAR(26)    NOT NULL,
  cargo_id     VARCHAR(128)   NOT NULL,
  shipment_id  VARCHAR(128)   NOT NULL,
  item_id      VARCHAR(128)   NOT NULL,
  quantity     INT            NOT NULL DEFAULT 1,
  weight       DECIMAL(10,3)  NOT NULL DEFAULT 0.000,
  is_contraband TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargo_id (cargo_id),
  INDEX idx_cargo_shipment (shipment_id),
  INDEX idx_cargo_item (item_id),
  INDEX idx_cargo_contraband (is_contraband)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
