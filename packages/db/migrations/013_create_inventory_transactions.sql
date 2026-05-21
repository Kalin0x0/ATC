-- Migration 013: Inventory transaction ledger (append-only audit log)
-- Every inventory mutation produces exactly one ledger row.
-- UNIQUE(idempotency_key) is the DB-level safety net for double-write prevention.

CREATE TABLE IF NOT EXISTS atc_inventory_transactions (
  id              CHAR(26)                                        NOT NULL,
  character_id    CHAR(26)                                        NOT NULL,
  type            ENUM('add','remove','move','set')               NOT NULL,
  item_id         VARCHAR(64)                                     NULL,
  slot_from       INT UNSIGNED                                    NULL,
  slot_to         INT UNSIGNED                                    NULL,
  quantity        INT UNSIGNED                                    NULL,
  reason          VARCHAR(128)                                    NOT NULL,
  source          ENUM('system','admin','api','gameplay')         NOT NULL DEFAULT 'system',
  idempotency_key VARCHAR(128)                                    NOT NULL,
  payload_hash    CHAR(64)                                        NULL,
  metadata_json   JSON                                            NULL,
  created_at      DATETIME(3)                                     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_inv_tx_idempotency (idempotency_key),
  KEY idx_inv_tx_character (character_id),
  KEY idx_inv_tx_type      (type),
  KEY idx_inv_tx_item      (item_id),
  KEY idx_inv_tx_created   (created_at),
  CONSTRAINT fk_inv_tx_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
