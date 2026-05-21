CREATE TABLE IF NOT EXISTS atc_governance_runtime (
  id               VARCHAR(26)  NOT NULL,
  governance_id    VARCHAR(26)  NOT NULL,
  governance_type  ENUM('democracy','oligarchy','autocracy','federation','custom') NOT NULL,
  status           ENUM('active','suspended','dissolved','transitioning') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  region_id        VARCHAR(128) NULL,
  governance_nonce VARCHAR(128) NOT NULL,
  governance_data  JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_governance_id (governance_id),
  UNIQUE KEY uq_governance_nonce (governance_nonce, owner_server_id),
  KEY idx_governance_status (status),
  KEY idx_governance_region (region_id),
  KEY idx_governance_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
