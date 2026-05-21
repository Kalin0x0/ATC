ALTER TABLE atc_player_sessions
  ADD COLUMN IF NOT EXISTS character_id CHAR(26) NULL AFTER account_id,
  ADD KEY IF NOT EXISTS idx_sessions_character (character_id),
  ADD CONSTRAINT IF NOT EXISTS fk_sessions_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE SET NULL
