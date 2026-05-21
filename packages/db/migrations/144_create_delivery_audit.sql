CREATE TABLE IF NOT EXISTS atc_delivery_audit (
  id                        VARCHAR(26)   NOT NULL,
  audit_id                  VARCHAR(128)  NOT NULL,
  shipment_id               VARCHAR(128)  NOT NULL,
  action                    VARCHAR(64)   NOT NULL,
  performed_by_principal_id VARCHAR(128)  NULL,
  note                      TEXT          NULL,
  created_at                DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_audit_id (audit_id),
  INDEX idx_delivery_audit_shipment (shipment_id),
  INDEX idx_delivery_audit_action (action),
  INDEX idx_delivery_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
