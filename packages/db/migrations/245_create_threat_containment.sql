CREATE TABLE IF NOT EXISTS atc_threat_containment (
  id               VARCHAR(26)  NOT NULL,
  containment_id   VARCHAR(26)  NOT NULL,
  entity_id        VARCHAR(128) NOT NULL,
  containment_type ENUM('block','throttle','isolate','terminate','custom') NOT NULL,
  status           ENUM('active','completed','failed','released') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  containment_nonce VARCHAR(128) NOT NULL,
  completed_at     DATETIME(3)  NULL,
  containment_data JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_threat_containment_id (containment_id),
  UNIQUE KEY uq_threat_containment_nonce (containment_nonce, owner_server_id),
  KEY idx_threat_containment_entity (entity_id),
  KEY idx_threat_containment_status (status),
  KEY idx_threat_containment_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
