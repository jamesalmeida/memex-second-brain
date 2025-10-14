-- Migration to create image_descriptions table
-- Stores AI-generated descriptions of images for context in AI chat

CREATE TABLE IF NOT EXISTS image_descriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    model TEXT NOT NULL, -- OpenAI model used (e.g., gpt-4o, gpt-4o-mini)
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(item_id, image_url) -- One description per image URL per item
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_image_descriptions_item_id ON image_descriptions(item_id);
CREATE INDEX IF NOT EXISTS idx_image_descriptions_created_at ON image_descriptions(created_at DESC);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_updated_at_image_descriptions ON image_descriptions;
CREATE TRIGGER handle_updated_at_image_descriptions
    BEFORE UPDATE ON image_descriptions
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Enable Row Level Security
ALTER TABLE image_descriptions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies and recreate them
DROP POLICY IF EXISTS "Users can view image descriptions for their items" ON image_descriptions;
DROP POLICY IF EXISTS "Users can insert image descriptions for their items" ON image_descriptions;
DROP POLICY IF EXISTS "Users can update image descriptions for their items" ON image_descriptions;
DROP POLICY IF EXISTS "Users can delete image descriptions for their items" ON image_descriptions;

-- Create RLS policies
CREATE POLICY "Users can view image descriptions for their items" ON image_descriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = image_descriptions.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert image descriptions for their items" ON image_descriptions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = image_descriptions.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update image descriptions for their items" ON image_descriptions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = image_descriptions.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete image descriptions for their items" ON image_descriptions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = image_descriptions.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON TABLE image_descriptions IS 'Stores AI-generated descriptions of images to provide context for AI chat';
COMMENT ON COLUMN image_descriptions.item_id IS 'Foreign key to items table';
COMMENT ON COLUMN image_descriptions.image_url IS 'URL of the image that was described';
COMMENT ON COLUMN image_descriptions.description IS 'AI-generated detailed description of the image';
COMMENT ON COLUMN image_descriptions.model IS 'OpenAI model used to generate the description';
COMMENT ON COLUMN image_descriptions.fetched_at IS 'Timestamp when the description was generated';
