CREATE TABLE IF NOT EXISTS atc_asset_valuations (
  id                      VARCHAR(26)    NOT NULL,
  property_id             VARCHAR(128)   NOT NULL,
  valued_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  valuation_amount        VARCHAR(24)    NOT NULL DEFAULT '0',
  previous_amount         VARCHAR(24)    NULL,
  valued_by_principal_id  VARCHAR(128)   NULL,
  method                  VARCHAR(64)    NOT NULL DEFAULT 'manual',
  notes                   TEXT           NULL,
  created_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_valuation_property (property_id),
  INDEX idx_valuation_valued_at (valued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
