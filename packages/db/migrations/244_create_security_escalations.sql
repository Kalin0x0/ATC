CREATE TABLE IF NOT EXISTS atc_security_escalations (
  id               VARCHAR(26)  NOT NULL,
  escalation_id    VARCHAR(26)  NOT NULL,
  escalation_type  ENUM('admin_review','automated_ban','service_isolation','emergency_shutdown','custom') NOT NULL,
  status           ENUM('pending','active','resolved','dismissed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  entity_id        VARCHAR(128) NULL,
  escalation_nonce VARCHAR(128) NOT NULL,
  resolved_at      DATETIME(3)  NULL,
  escalation_data  JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_security_escalation_id (escalation_id),
  UNIQUE KEY uq_security_escalation_nonce (escalation_nonce, owner_server_id),
  KEY idx_security_escalations_status (status),
  KEY idx_security_escalations_entity (entity_id),
  KEY idx_security_escalations_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
