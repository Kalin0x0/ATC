CREATE TABLE IF NOT EXISTS atc_manufacturing_queues (
  id                     VARCHAR(26)   NOT NULL,
  queue_id               VARCHAR(128)  NOT NULL,
  station_id             VARCHAR(128)  NOT NULL,
  station_type           VARCHAR(64)   NOT NULL DEFAULT 'workbench',
  status                 VARCHAR(32)   NOT NULL DEFAULT 'idle',
  current_job_id         VARCHAR(128)  NULL,
  operator_principal_id  VARCHAR(128)  NULL,
  created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_queue_id (queue_id),
  UNIQUE KEY uq_queue_station (station_id),
  INDEX idx_queue_status (status),
  INDEX idx_queue_station_type (station_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
