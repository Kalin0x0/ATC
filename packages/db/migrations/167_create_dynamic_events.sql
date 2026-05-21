CREATE TABLE IF NOT EXISTS atc_dynamic_events (
  id              VARCHAR(26)   NOT NULL,
  event_id        VARCHAR(26)   NOT NULL,
  event_nonce     VARCHAR(128)  NOT NULL,
  event_type      VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  trigger_data    TEXT          NOT NULL DEFAULT '{}',
  zone_id         VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NULL,
  expires_at      DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_dynamic_events_event_id (event_id),
  UNIQUE KEY uq_dynamic_events_nonce (event_nonce),
  KEY idx_dynamic_events_status (status),
  KEY idx_dynamic_events_zone (zone_id),
  KEY idx_dynamic_events_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
