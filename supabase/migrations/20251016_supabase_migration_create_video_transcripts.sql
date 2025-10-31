-- Migration to create video_transcripts table
-- This handles both new installations and migrations from youtube_transcripts

-- First, check if youtube_transcripts exists and rename it, or create video_transcripts fresh
DO $$ 
BEGIN
    -- Check if youtube_transcripts table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'youtube_transcripts') THEN
        -- Rename existing table
        ALTER TABLE youtube_transcripts RENAME TO video_transcripts;
        
        -- Add platform column if it doesn't exist
        ALTER TABLE video_transcripts 
        ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'youtube';
        
        -- Update existing records
        UPDATE video_transcripts SET platform = 'youtube' WHERE platform IS NULL;
        
        -- Add NOT NULL constraint
        ALTER TABLE video_transcripts ALTER COLUMN platform SET NOT NULL;
        
        -- Drop old indexes
        DROP INDEX IF EXISTS idx_youtube_transcripts_item_id;
        DROP INDEX IF EXISTS idx_youtube_transcripts_created_at;
        
        -- Drop old trigger
        DROP TRIGGER IF EXISTS handle_updated_at_youtube_transcripts ON video_transcripts;
    ELSE
        -- Create video_transcripts table fresh
        CREATE TABLE IF NOT EXISTS video_transcripts (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            transcript TEXT NOT NULL,
            platform TEXT NOT NULL DEFAULT 'youtube',
            language TEXT DEFAULT 'en',
            duration INTEGER, -- Duration in seconds
            fetched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            UNIQUE(item_id) -- One transcript per item
        );
    END IF;
END $$;

-- Create indexes (will work whether table was renamed or created fresh)
CREATE INDEX IF NOT EXISTS idx_video_transcripts_item_id ON video_transcripts(item_id);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_created_at ON video_transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_platform ON video_transcripts(platform);

-- Create or replace trigger for updated_at
DROP TRIGGER IF EXISTS handle_updated_at_video_transcripts ON video_transcripts;
CREATE TRIGGER handle_updated_at_video_transcripts
    BEFORE UPDATE ON video_transcripts
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Enable Row Level Security
ALTER TABLE video_transcripts ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies and recreate them
DROP POLICY IF EXISTS "Users can view transcripts for their items" ON video_transcripts;
DROP POLICY IF EXISTS "Users can insert transcripts for their items" ON video_transcripts;
DROP POLICY IF EXISTS "Users can update transcripts for their items" ON video_transcripts;
DROP POLICY IF EXISTS "Users can delete transcripts for their items" ON video_transcripts;

-- Create RLS policies
CREATE POLICY "Users can view transcripts for their items" ON video_transcripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transcripts for their items" ON video_transcripts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update transcripts for their items" ON video_transcripts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete transcripts for their items" ON video_transcripts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM items
            WHERE items.id = video_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON TABLE video_transcripts IS 'Stores transcripts for videos from various platforms (YouTube, X, TikTok, Instagram, Reddit, etc.)';
COMMENT ON COLUMN video_transcripts.platform IS 'Platform source: youtube, x, tiktok, instagram, reddit, etc.';
COMMENT ON COLUMN video_transcripts.item_id IS 'Foreign key to items table - one transcript per video item';
COMMENT ON COLUMN video_transcripts.transcript IS 'Full text transcript of the video';
COMMENT ON COLUMN video_transcripts.language IS 'Language code of the transcript (e.g., en, es, fr)';
COMMENT ON COLUMN video_transcripts.duration IS 'Video duration in seconds';
COMMENT ON COLUMN video_transcripts.fetched_at IS 'Timestamp when the transcript was fetched from the platform';