-- Migration to add missing columns to spaces table
-- Run this in your Supabase SQL editor

-- Add description column (optional text field)
ALTER TABLE spaces 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add item_count column (integer with default 0)
ALTER TABLE spaces 
ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 0;

-- Add timestamps if they don't exist
ALTER TABLE spaces 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE spaces 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an update trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_spaces_updated_at ON spaces;
CREATE TRIGGER update_spaces_updated_at 
    BEFORE UPDATE ON spaces 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to describe the table
COMMENT ON TABLE spaces IS 'User-created spaces/collections for organizing items';
COMMENT ON COLUMN spaces.description IS 'Optional description of the space';
COMMENT ON COLUMN spaces.item_count IS 'Number of items in this space (denormalized for performance)';