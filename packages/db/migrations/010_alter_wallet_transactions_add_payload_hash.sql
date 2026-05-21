-- Migration 010: Add payload_hash to wallet transactions
-- Stores a SHA-256 hex digest of the canonicalized mutation payload
-- (amount + account/fromAccount + currency). Used to detect idempotency key
-- reuse with a different payload, which indicates a caller bug.
-- NULL for records written before this migration (skips verification on replay).

ALTER TABLE atc_wallet_transactions
  ADD COLUMN payload_hash CHAR(64) NULL
    AFTER idempotency_key;
