-- Phase 27 — Entity Relationship Graph: typed directional edges
-- Append-only edge log. Edges are immutable; relationship end-of-life is
-- modelled via `ended_at`. Traversal is optimised by composite indexes on
-- both endpoints + edge type.
CREATE TABLE IF NOT EXISTS atc_entity_relationships (
  id              CHAR(26)     NOT NULL,
  from_entity_id  CHAR(26)     NOT NULL,
  to_entity_id    CHAR(26)     NOT NULL,
  relationship    VARCHAR(64)  NOT NULL,
  weight          DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  source_system   VARCHAR(64)  NOT NULL,
  attribution     VARCHAR(128) NULL,
  metadata_json   TEXT         NULL,
  observed_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at        DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_rel_from         (from_entity_id, relationship, observed_at),
  KEY idx_rel_to           (to_entity_id, relationship, observed_at),
  KEY idx_rel_pair         (from_entity_id, to_entity_id, relationship),
  KEY idx_rel_type         (relationship),
  KEY idx_rel_observed     (observed_at),
  KEY idx_rel_active       (ended_at),
  CONSTRAINT chk_rel_endpoints CHECK (from_entity_id <> to_entity_id),
  CONSTRAINT chk_rel_weight    CHECK (weight >= 0 AND weight <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
