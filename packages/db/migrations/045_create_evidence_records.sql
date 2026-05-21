-- Phase 24 — Government: evidence records (immutable hash, append-only chain of custody)
CREATE TABLE IF NOT EXISTS atc_evidence_records (
  id                        CHAR(26)     NOT NULL,
  case_id                   CHAR(26)     NULL,
  collected_by_principal_id CHAR(26)     NOT NULL,
  label                     VARCHAR(512) NOT NULL,
  metadata_json             JSON         NULL,
  content_hash              CHAR(64)     NOT NULL COMMENT 'SHA-256 hex of canonical evidence fingerprint at collection time',
  chain_of_custody_json     JSON         NOT NULL DEFAULT ('[]'),
  created_at                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_evidence_case      (case_id),
  KEY idx_evidence_collector (collected_by_principal_id),
  KEY idx_evidence_hash      (content_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
