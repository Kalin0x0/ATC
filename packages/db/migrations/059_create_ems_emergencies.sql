CREATE TABLE atc_ems_emergencies (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  incident_id              VARCHAR(128) NULL,
  status                   ENUM(
    'reported','triaged','responders_assigned','en_route',
    'on_scene','stabilized','transported','admitted','closed'
  ) NOT NULL DEFAULT 'reported',
  triage_category          ENUM('red','yellow','green','black') NULL,
  assigned_responder_ids   JSON         NOT NULL DEFAULT ('[]'),
  notes                    TEXT         NULL,
  created_by_principal_id  VARCHAR(128) NOT NULL,
  closed_at                DATETIME(3)  NULL,
  created_at               DATETIME(3)  NOT NULL,
  updated_at               DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_ems_emergency_character (character_id),
  INDEX idx_ems_emergency_status    (status),
  INDEX idx_ems_emergency_incident  (incident_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
