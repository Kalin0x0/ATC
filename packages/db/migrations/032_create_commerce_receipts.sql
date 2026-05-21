-- Phase 22 — Commerce: receipts (immutable, one per completed order)
-- Receipts are the human-readable proof of a completed transaction.
-- UNIQUE(order_id) enforces one receipt per order at the DB level.
CREATE TABLE IF NOT EXISTS atc_commerce_receipts (
  id              CHAR(26)        NOT NULL,
  order_id        CHAR(26)        NOT NULL,
  order_type      VARCHAR(10)     NOT NULL,
  character_id    VARCHAR(128)    NOT NULL,
  shop_id         CHAR(26)        NOT NULL,
  item_id         VARCHAR(64)     NOT NULL,
  item_name       VARCHAR(256)    NULL,
  quantity        INT UNSIGNED    NOT NULL,
  unit_price      DECIMAL(20,4)   NOT NULL,
  subtotal_amount DECIMAL(20,4)   NOT NULL,
  tax_amount      DECIMAL(20,4)   NOT NULL,
  fee_amount      DECIMAL(20,4)   NOT NULL,
  total_amount    DECIMAL(20,4)   NOT NULL,
  currency        VARCHAR(16)     NOT NULL,
  journal_id      CHAR(26)        NOT NULL,
  issued_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipt_order (order_id),
  KEY idx_receipts_character (character_id),
  KEY idx_receipts_shop      (shop_id),
  KEY idx_receipts_issued    (issued_at),
  CONSTRAINT fk_receipts_order FOREIGN KEY (order_id) REFERENCES atc_commerce_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
