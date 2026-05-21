-- ATC Migration 021 — Durable Security Events
-- Append-only audit log written to the database for durability.
-- Complements the in-memory AtcAuditService ring buffer (Phase 19).
-- event_metadata avoids the reserved word 'metadata' in some SQL dialects.

CREATE TABLE IF NOT EXISTS atc_security_events (
    id                  CHAR(26)        NOT NULL,
    actor_id            VARCHAR(128)    NOT NULL,
    actor_type          VARCHAR(20)     NOT NULL,
    action              VARCHAR(256)    NOT NULL,
    target              VARCHAR(256)    NULL,
    result              VARCHAR(10)     NOT NULL,
    source_instance_id  VARCHAR(128)    NULL,
    event_metadata      JSON            NULL,
    created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    KEY idx_sec_events_actor   (actor_id),
    KEY idx_sec_events_action  (action(64)),
    KEY idx_sec_events_result  (result),
    KEY idx_sec_events_created (created_at),

    CONSTRAINT chk_sec_event_result CHECK (result IN ('granted', 'denied', 'error'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
