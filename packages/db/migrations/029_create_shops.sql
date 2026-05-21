-- Phase 22 — Commerce: shops catalog
CREATE TABLE IF NOT EXISTS atc_shops (
  id                 CHAR(26)        NOT NULL,
  name               VARCHAR(256)    NOT NULL,
  type               VARCHAR(20)     NOT NULL,
  status             VARCHAR(20)     NOT NULL DEFAULT 'active',
  owner_org_id       CHAR(26)        NULL,
  seller_account_id  CHAR(26)        NULL  COMMENT 'Financial account that receives revenue from player purchases',
  buyer_account_id   CHAR(26)        NULL  COMMENT 'Financial account that pays players when shop buys items',
  currency           VARCHAR(16)     NOT NULL DEFAULT 'USD',
  metadata_json      JSON            NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_shops_type      (type),
  KEY idx_shops_status    (status),
  KEY idx_shops_owner_org (owner_org_id),
  CONSTRAINT chk_shops_type   CHECK (type   IN ('npc','player','organization','vending','admin')),
  CONSTRAINT chk_shops_status CHECK (status IN ('active','disabled','maintenance'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
