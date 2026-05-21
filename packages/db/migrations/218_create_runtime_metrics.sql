CREATE TABLE IF NOT EXISTS atc_runtime_metrics (
  id              VARCHAR(26)   NOT NULL,
  metric_id       VARCHAR(128)  NOT NULL,
  metric_type     VARCHAR(64)   NOT NULL,
  entity_id       VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  value           DOUBLE        NOT NULL DEFAULT 0,
  unit            VARCHAR(32)   NULL,
  metric_data     TEXT          NOT NULL DEFAULT '{}',
  recorded_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_metric_entity (entity_id),
  KEY idx_metric_type (metric_type),
  KEY idx_metric_recorded (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
