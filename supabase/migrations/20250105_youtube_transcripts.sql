-- Create YouTube Transcripts table
-- Stores transcripts for YouTube videos linked to items

CREATE TABLE IF NOT EXISTS public.youtube_transcripts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    transcript TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    duration INTEGER, -- Duration in seconds
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(item_id) -- One transcript per item
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_youtube_transcripts_item_id ON public.youtube_transcripts(item_id);
CREATE INDEX IF NOT EXISTS idx_youtube_transcripts_created_at ON public.youtube_transcripts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.youtube_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for YouTube Transcripts
CREATE POLICY "Users can view transcripts for their items" ON public.youtube_transcripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = youtube_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transcripts for their items" ON public.youtube_transcripts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = youtube_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update transcripts for their items" ON public.youtube_transcripts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = youtube_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete transcripts for their items" ON public.youtube_transcripts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = youtube_transcripts.item_id
            AND items.user_id = auth.uid()
        )
    );

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at_youtube_transcripts
    BEFORE UPDATE ON public.youtube_transcripts
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.youtube_transcripts IS 'Stores transcripts for YouTube videos associated with items';
COMMENT ON COLUMN public.youtube_transcripts.item_id IS 'Foreign key to items table - one transcript per YouTube item';
COMMENT ON COLUMN public.youtube_transcripts.transcript IS 'Full text transcript of the YouTube video';
COMMENT ON COLUMN public.youtube_transcripts.language IS 'Language code of the transcript (e.g., en, es, fr)';
COMMENT ON COLUMN public.youtube_transcripts.duration IS 'Video duration in seconds';
COMMENT ON COLUMN public.youtube_transcripts.fetched_at IS 'Timestamp when the transcript was fetched from YouTube';