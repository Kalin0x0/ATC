-- Migration 015: Item catalog admin fields
-- Adds image, icon, tags, sort ordering, and version tracking to item definitions.
-- Does NOT remove or rename any existing columns; existing inventory FKs remain intact.

ALTER TABLE atc_item_definitions
  ADD COLUMN IF NOT EXISTS image_url  VARCHAR(512)   NULL         AFTER metadata_schema_json,
  ADD COLUMN IF NOT EXISTS icon       VARCHAR(128)   NULL         AFTER image_url,
  ADD COLUMN IF NOT EXISTS tags_json  JSON           NULL         AFTER icon,
  ADD COLUMN IF NOT EXISTS sort_order INT            NOT NULL DEFAULT 0   AFTER tags_json,
  ADD COLUMN IF NOT EXISTS version    INT UNSIGNED   NOT NULL DEFAULT 1   AFTER sort_order;

CREATE INDEX IF NOT EXISTS idx_items_sort_order        ON atc_item_definitions (sort_order);
CREATE INDEX IF NOT EXISTS idx_items_category_status   ON atc_item_definitions (category, status);
