-- Migration: Add archive support and simplify space relationship
-- This migration:
-- 1. Adds archive fields to items and spaces
-- 2. Moves space_id from item_spaces to items table (one space per item)
-- 3. Migrates existing data from item_spaces to items.space_id (keeping first space)
-- 4. Marks item_spaces table as deprecated

-- Step 1: Add archive fields to items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_archived BOOLEAN DEFAULT FALSE;

-- Step 2: Add archive fields to spaces table
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Step 3: Add space_id to items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE SET NULL;

-- Step 4: Migrate existing data from item_spaces to items.space_id
-- For each item, take the FIRST space relationship (based on created_at)
WITH first_spaces AS (
  SELECT DISTINCT ON (item_id)
    item_id,
    space_id
  FROM item_spaces
  ORDER BY item_id, created_at ASC
)
UPDATE items
SET space_id = first_spaces.space_id
FROM first_spaces
WHERE items.id = first_spaces.item_id;

-- Step 5: Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_items_is_archived ON items(is_archived);
CREATE INDEX IF NOT EXISTS idx_items_space_id ON items(space_id);
CREATE INDEX IF NOT EXISTS idx_spaces_is_archived ON spaces(is_archived);

-- Step 6: Add comments for documentation
COMMENT ON COLUMN items.is_archived IS 'Archive flag - true if item is archived';
COMMENT ON COLUMN items.archived_at IS 'Timestamp when item was archived';
COMMENT ON COLUMN items.auto_archived IS 'True if item was auto-archived when its space was archived (for restoration)';
COMMENT ON COLUMN items.space_id IS 'Single space this item belongs to (replaces many-to-many item_spaces relationship)';
COMMENT ON COLUMN spaces.is_archived IS 'Archive flag - true if space is archived';
COMMENT ON COLUMN spaces.archived_at IS 'Timestamp when space was archived';

-- Step 7: Add constraint to ensure archived items have archived_at timestamp
-- (This is a best practice but not enforced at DB level - handled in application layer)

-- Note: item_spaces table is now DEPRECATED but kept for backwards compatibility
-- New code should use items.space_id instead
COMMENT ON TABLE item_spaces IS 'DEPRECATED: Use items.space_id instead. Kept for backwards compatibility during migration period.';
