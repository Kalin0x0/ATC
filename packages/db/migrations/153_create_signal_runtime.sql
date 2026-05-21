CREATE TABLE IF NOT EXISTS atc_signal_runtime (
  id               VARCHAR(26)    NOT NULL,
  signal_id        VARCHAR(128)   NOT NULL,
  channel_id       VARCHAR(128)   NULL,
  signal_type      VARCHAR(64)    NOT NULL,
  strength         DECIMAL(5,2)   NOT NULL DEFAULT 100.00,
  status           VARCHAR(32)    NOT NULL DEFAULT 'active',
  origin_zone_id   VARCHAR(128)   NULL,
  owner_server_id  VARCHAR(128)   NOT NULL,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_signal_id (signal_id),
  INDEX idx_signal_status (status),
  INDEX idx_signal_channel (channel_id),
  INDEX idx_signal_zone (origin_zone_id),
  INDEX idx_signal_last_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
