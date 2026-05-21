-- Allow slot to be NULL for soft-deleted characters so the slot number is freed for reuse.
-- MariaDB treats NULL values as distinct in unique indexes, so multiple deleted rows
-- with NULL slot for the same account are allowed. Only active/suspended rows keep their slot.
ALTER TABLE atc_characters
  MODIFY COLUMN slot TINYINT UNSIGNED NULL
