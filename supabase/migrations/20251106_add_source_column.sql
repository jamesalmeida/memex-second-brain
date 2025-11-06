-- Add source column to items table to track where items came from
-- This enables Phase 2 enrichment for Share Extension items

ALTER TABLE items ADD COLUMN IF NOT EXISTS source TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN items.source IS 'Source of the item: "share_extension", "manual", "import", etc. Used to trigger specialized enrichment pipelines.';

-- Create index for faster queries by source
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
