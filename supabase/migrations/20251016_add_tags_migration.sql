-- Add tags column to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT NULL;

-- Create GIN index for efficient array operations and searches
CREATE INDEX IF NOT EXISTS idx_items_tags ON items USING GIN (tags);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN items.tags IS 'Array of tags associated with the item for categorization and search';