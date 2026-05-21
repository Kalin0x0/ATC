CREATE TABLE IF NOT EXISTS atc_crafting_resource_consumption (
  id            VARCHAR(26)   NOT NULL,
  consumer_id   VARCHAR(128)  NOT NULL,
  resource_type VARCHAR(64)   NOT NULL,
  amount        DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  consumed_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  period_label  VARCHAR(64)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_craft_res_consumer (consumer_id),
  INDEX idx_craft_res_type (resource_type),
  INDEX idx_craft_res_period (period_label),
  INDEX idx_craft_res_consumed (consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
