-- Migration to add segments JSONB column to video_transcripts table
-- This allows storing timestamped transcript segments for toggling between timestamped and plain text views

ALTER TABLE video_transcripts 
ADD COLUMN IF NOT EXISTS segments JSONB;

-- Add comment for documentation
COMMENT ON COLUMN video_transcripts.segments IS 'JSONB array of transcript segments with timing data: [{"startMs": number, "endMs": number, "text": string}]. Used for timestamped transcript display.';

-- Create index for JSONB queries (optional but can help with queries)
CREATE INDEX IF NOT EXISTS idx_video_transcripts_segments ON video_transcripts USING gin (segments) WHERE segments IS NOT NULL;

