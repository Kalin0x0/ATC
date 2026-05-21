-- Phase 27 — Entity Registry: canonical entity directory
-- Append-safe, idempotent, indexed for high-cardinality lookups.
CREATE TABLE IF NOT EXISTS atc_entity_registry (
  id              CHAR(26)     NOT NULL,
  entity_type     VARCHAR(32)  NOT NULL,
  external_id     VARCHAR(128) NOT NULL,
  display_name    VARCHAR(255) NULL,
  source_system   VARCHAR(64)  NOT NULL,
  metadata_json   TEXT         NULL,
  visibility      VARCHAR(20)  NOT NULL DEFAULT 'public',
  created_by      VARCHAR(128) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_entity_type_external (entity_type, external_id),
  KEY idx_entity_type        (entity_type),
  KEY idx_entity_external    (external_id),
  KEY idx_entity_display     (display_name),
  KEY idx_entity_source      (source_system),
  KEY idx_entity_visibility  (visibility),
  KEY idx_entity_created     (created_at),
  CONSTRAINT chk_entity_type CHECK (
    entity_type IN (
      'character','vehicle','incident','warrant','arrest',
      'citation','bolo','evidence','organization','account'
    )
  ),
  CONSTRAINT chk_entity_visibility CHECK (visibility IN ('public','internal','restricted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
