-- Add standalone index on atc_account_identifiers.identifier for cross-identifier lookups.
-- The existing composite index (identifier_type, identifier) doesn't efficiently serve
-- queries that search by identifier value alone across all types.
ALTER TABLE atc_account_identifiers
  ADD INDEX idx_identifiers_value (identifier)
