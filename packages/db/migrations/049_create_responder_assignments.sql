-- Phase 25 — Dispatch: responder assignments to incidents
CREATE TABLE IF NOT EXISTS atc_responder_assignments (
  id                CHAR(26)    NOT NULL,
  incident_id       CHAR(26)    NOT NULL,
  principal_id      CHAR(26)    NOT NULL,
  character_id      CHAR(26)    NULL,
  agency_id         CHAR(26)    NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'assigned',
  assigned_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status_updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cleared_at        DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_responder_incident  (incident_id),
  KEY idx_responder_principal (principal_id),
  KEY idx_responder_agency    (agency_id),
  KEY idx_responder_status    (status),
  CONSTRAINT chk_responder_status CHECK (status IN ('assigned','enroute','on_scene','unavailable','cleared')),
  CONSTRAINT fk_responder_incident FOREIGN KEY (incident_id) REFERENCES atc_incidents (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
