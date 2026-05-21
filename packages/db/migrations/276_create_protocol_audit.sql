CREATE TABLE IF NOT EXISTS atc_protocol_audit (
  id              VARCHAR(26)  NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  protocol_id     VARCHAR(26)  NULL,
  contract_id     VARCHAR(26)  NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  KEY idx_protocol_audit_type (event_type),
  KEY idx_protocol_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
