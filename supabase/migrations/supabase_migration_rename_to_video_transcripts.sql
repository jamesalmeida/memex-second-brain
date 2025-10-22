-- Migration to rename youtube_transcripts to video_transcripts
-- and add platform column to support transcripts from multiple video platforms

-- Rename the table
ALTER TABLE youtube_transcripts RENAME TO video_transcripts;

-- Add platform column to identify video source
ALTER TABLE video_transcripts 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'youtube';

-- Update any existing records to have 'youtube' as platform
UPDATE video_transcripts SET platform = 'youtube' WHERE platform IS NULL;

-- Add NOT NULL constraint after setting defaults
ALTER TABLE video_transcripts ALTER COLUMN platform SET NOT NULL;

-- Drop old indexes
DROP INDEX IF EXISTS idx_youtube_transcripts_item_id;
DROP INDEX IF EXISTS idx_youtube_transcripts_created_at;

-- Create new indexes with updated names
CREATE INDEX IF NOT EXISTS idx_video_transcripts_item_id ON video_transcripts(item_id);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_created_at ON video_transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_platform ON video_transcripts(platform);

-- Update the trigger name
DROP TRIGGER IF EXISTS handle_updated_at_youtube_transcripts ON video_transcripts;
CREATE TRIGGER handle_updated_at_video_transcripts
    BEFORE UPDATE ON video_transcripts
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Update RLS policies with new table name
DROP POLICY IF EXISTS "Users can view transcripts for their items" ON video_transcripts;
DROP POLICY IF EXISTS "Users can insert transcripts for their items" ON video_transcripts;
DROP POLICY IF EXISTS "Users can update transcripts for their items" ON video_transcripts;
DROP POLICY IF EXISTS "Users can delete transcripts for their items" ON video_transcripts;

-- Recreate RLS policies
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

-- Update table and column comments
COMMENT ON TABLE video_transcripts IS 'Stores transcripts for videos from various platforms (YouTube, X, TikTok, Instagram, Reddit, etc.)';
COMMENT ON COLUMN video_transcripts.platform IS 'Platform source: youtube, x, tiktok, instagram, reddit, etc.';
COMMENT ON COLUMN video_transcripts.item_id IS 'Foreign key to items table - one transcript per video item';
COMMENT ON COLUMN video_transcripts.transcript IS 'Full text transcript of the video';
COMMENT ON COLUMN video_transcripts.language IS 'Language code of the transcript (e.g., en, es, fr)';
COMMENT ON COLUMN video_transcripts.duration IS 'Video duration in seconds';
COMMENT ON COLUMN video_transcripts.fetched_at IS 'Timestamp when the transcript was fetched from the platform';