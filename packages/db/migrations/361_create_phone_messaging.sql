-- ---------------------------------------------------------------------------
-- 361_create_phone_messaging.sql
-- ---------------------------------------------------------------------------
-- Phase 98 — Phone messaging: direct messages between characters and the
-- contact list behind them.
--
-- Distinct from the radio system in atc_radio_channels and atc_signal_runtime:
-- that is tactical comms between units, this is a character's phone. They share
-- the /api/v1/comms namespace but no tables.

CREATE TABLE IF NOT EXISTS atc_phone_messages (
  id                  CHAR(26)      NOT NULL,
  from_character_id   CHAR(26)      NOT NULL,
  to_character_id     CHAR(26)      NOT NULL,
  body                VARCHAR(1024) NOT NULL,
  -- Set when the recipient's client has displayed the message. NULL = unread.
  read_at             DATETIME(3)   NULL,
  -- Prevents a retried send from delivering twice.
  idempotency_key     VARCHAR(128)  NOT NULL,
  sent_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_phone_msg_idem (idempotency_key),
  -- Conversation lookup: both directions between a pair, newest first.
  INDEX idx_phone_msg_pair (from_character_id, to_character_id, sent_at),
  INDEX idx_phone_msg_inbox (to_character_id, sent_at),
  INDEX idx_phone_msg_unread (to_character_id, read_at),
  CONSTRAINT fk_phone_msg_from FOREIGN KEY (from_character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_phone_msg_to FOREIGN KEY (to_character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_phone_contacts (
  id                    CHAR(26)     NOT NULL,
  owner_character_id    CHAR(26)     NOT NULL,
  contact_character_id  CHAR(26)     NOT NULL,
  -- What the owner calls this contact; not the contact's own character name.
  display_name          VARCHAR(64)  NOT NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                     ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- One entry per contact per owner; re-adding updates the name instead.
  UNIQUE KEY uq_phone_contact (owner_character_id, contact_character_id),
  INDEX idx_phone_contact_owner (owner_character_id),
  CONSTRAINT fk_phone_contact_owner FOREIGN KEY (owner_character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_phone_contact_target FOREIGN KEY (contact_character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
