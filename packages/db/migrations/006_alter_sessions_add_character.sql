ALTER TABLE atc_player_sessions
  ADD COLUMN IF NOT EXISTS character_id CHAR(26) NULL AFTER account_id,
  ADD KEY IF NOT EXISTS idx_sessions_character (character_id),
  -- MariaDB rejects "ADD CONSTRAINT IF NOT EXISTS <name> FOREIGN KEY"; the
  -- IF NOT EXISTS belongs on ADD FOREIGN KEY instead. The CHECK form in
  -- migration 016 is valid as written — this restriction is specific to
  -- foreign keys.
  ADD FOREIGN KEY IF NOT EXISTS fk_sessions_character (character_id)
    REFERENCES atc_characters (id) ON DELETE SET NULL
