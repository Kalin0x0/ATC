-- Phase 22 — Commerce: tax and fee rules
-- Shared table for both tax and fee rules, distinguished by 'category'.
-- rate: percentage 0-100 for 'percentage' type; fixed monetary amount for 'flat' type.
-- currency NULL means the rule applies to all currencies.
-- applies_to_shop_type NULL means the rule applies to all shop types.
CREATE TABLE IF NOT EXISTS atc_tax_rules (
  id                    CHAR(26)        NOT NULL,
  name                  VARCHAR(256)    NOT NULL,
  category              VARCHAR(5)      NOT NULL  COMMENT 'tax | fee',
  type                  VARCHAR(12)     NOT NULL  COMMENT 'percentage | flat',
  rate                  DECIMAL(10,4)   NOT NULL,
  currency              VARCHAR(16)     NULL      COMMENT 'NULL = all currencies',
  applies_to_shop_type  VARCHAR(20)     NULL      COMMENT 'NULL = all shop types',
  target_account_id     CHAR(26)        NOT NULL  COMMENT 'Financial account that collects the tax/fee',
  is_active             TINYINT(1)      NOT NULL  DEFAULT 1,
  created_at            DATETIME(3)     NOT NULL  DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_tax_rules_active   (is_active),
  KEY idx_tax_rules_category (category),
  KEY idx_tax_rules_currency (currency),
  CONSTRAINT chk_tax_rules_category  CHECK (category IN ('tax','fee')),
  CONSTRAINT chk_tax_rules_type      CHECK (type     IN ('percentage','flat')),
  CONSTRAINT chk_tax_rules_rate      CHECK (rate >= 0),
  CONSTRAINT chk_tax_rules_shop_type CHECK (applies_to_shop_type IS NULL OR applies_to_shop_type IN ('npc','player','organization','vending','admin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
