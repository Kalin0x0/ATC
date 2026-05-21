CREATE TABLE IF NOT EXISTS atc_emergency_response (
  id                      VARCHAR(26)    NOT NULL,
  response_id             VARCHAR(128)   NOT NULL,
  disaster_id             VARCHAR(128)   NULL,
  response_type           VARCHAR(64)    NOT NULL,
  responder_principal_id  VARCHAR(128)   NULL,
  status                  VARCHAR(32)    NOT NULL DEFAULT 'dispatched',
  dispatched_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  arrived_at              DATETIME(3)    NULL,
  completed_at            DATETIME(3)    NULL,
  created_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_response_id (response_id),
  INDEX idx_response_disaster (disaster_id),
  INDEX idx_response_type (response_type),
  INDEX idx_response_status (status),
  INDEX idx_response_responder (responder_principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
