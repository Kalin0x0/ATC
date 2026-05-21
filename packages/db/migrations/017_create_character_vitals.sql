-- ATC Migration 017 — Character Vitals
-- Creates the atc_character_vitals table for server-authoritative player state.
-- All mutations happen server-side only. Clients are never trusted for vitals values.
--
-- Column types: TINYINT UNSIGNED (1 byte, 0–255) is correct for 0–100 vitals.
-- Timestamps: DATETIME(3) for millisecond precision, consistent with all ATC tables.

CREATE TABLE IF NOT EXISTS atc_character_vitals (
    character_id  CHAR(26)          NOT NULL,
    health        TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    hunger        TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    thirst        TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    stamina       TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    stress        TINYINT UNSIGNED  NOT NULL DEFAULT 0,
    armor         TINYINT UNSIGNED  NOT NULL DEFAULT 0,
    created_at    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (character_id),

    CONSTRAINT fk_vitals_character
        FOREIGN KEY (character_id) REFERENCES atc_characters (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_vitals_health  CHECK (health  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_hunger  CHECK (hunger  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_thirst  CHECK (thirst  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_stamina CHECK (stamina BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_stress  CHECK (stress  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_armor   CHECK (armor   BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
