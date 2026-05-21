CREATE TABLE IF NOT EXISTS atc_gateway_audit (
  id              CHAR(26)     NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  resource_id     VARCHAR(128) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_gateway_audit_event (event_type),
  INDEX idx_gateway_audit_resource (resource_id),
  INDEX idx_gateway_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
