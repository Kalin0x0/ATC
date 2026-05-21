CREATE TABLE IF NOT EXISTS atc_governance_audit (
  id               VARCHAR(26)  NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  governance_id    VARCHAR(26)  NULL,
  entity_id        VARCHAR(128) NULL,
  region_id        VARCHAR(128) NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_governance_audit_event (event_type),
  KEY idx_governance_audit_governance (governance_id),
  KEY idx_governance_audit_region (region_id),
  KEY idx_governance_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
