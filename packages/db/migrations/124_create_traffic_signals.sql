CREATE TABLE IF NOT EXISTS atc_traffic_signals (
  id               VARCHAR(26)    NOT NULL,
  signal_id        VARCHAR(128)   NOT NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  state            VARCHAR(32)    NOT NULL DEFAULT 'green',
  cycle_duration   INT            NOT NULL DEFAULT 30,
  is_overridden    TINYINT(1)     NOT NULL DEFAULT 0,
  override_by      VARCHAR(128)   NULL,
  override_until   DATETIME(3)    NULL,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_traffic_signal_id (signal_id),
  INDEX idx_traffic_zone (zone_id),
  INDEX idx_traffic_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
