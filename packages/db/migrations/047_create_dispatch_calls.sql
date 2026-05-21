-- Phase 25 — Dispatch: inbound calls (civilian/officer/api) awaiting dispatch
CREATE TABLE IF NOT EXISTS atc_dispatch_calls (
  id                 CHAR(26)     NOT NULL,
  source             VARCHAR(20)  NOT NULL DEFAULT 'civilian',
  caller_identifier  VARCHAR(255) NULL,
  location           VARCHAR(512) NOT NULL,
  priority           VARCHAR(20)  NOT NULL DEFAULT 'medium',
  description        TEXT         NOT NULL,
  incident_id        CHAR(26)     NULL,
  idempotency_key    VARCHAR(255) NOT NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  accepted_at        DATETIME(3)  NULL,
  closed_at          DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dispatch_idempotency (idempotency_key),
  KEY idx_dispatch_source   (source),
  KEY idx_dispatch_priority (priority),
  KEY idx_dispatch_incident (incident_id),
  KEY idx_dispatch_created  (created_at),
  CONSTRAINT chk_dispatch_source   CHECK (source   IN ('civilian','officer','automated','api')),
  CONSTRAINT chk_dispatch_priority CHECK (priority IN ('low','medium','high','critical'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
