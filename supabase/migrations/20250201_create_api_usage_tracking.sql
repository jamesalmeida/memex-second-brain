-- Create API usage tracking table
-- Tracks API calls that count against monthly limits (excludes free operations like account status)

CREATE TABLE IF NOT EXISTS public.api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_name TEXT NOT NULL, -- e.g., 'serpapi'
  operation_type TEXT NOT NULL, -- e.g., 'youtube_enrichment', 'youtube_transcript'
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL, -- Optional: link to item if applicable
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_api_name CHECK (api_name IN ('serpapi')), -- Extend as needed
  CONSTRAINT valid_operation_type CHECK (
    (api_name = 'serpapi' AND operation_type IN ('youtube_enrichment', 'youtube_transcript', 'ebay_product', 'yelp_business', 'app_store'))
    -- Add other API constraints as needed
  )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON public.api_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_name ON public.api_usage_tracking(api_name);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_api_date ON public.api_usage_tracking(user_id, api_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_item_id ON public.api_usage_tracking(item_id) WHERE item_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.api_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own usage records
CREATE POLICY "Users can read own API usage"
  ON public.api_usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own usage records
CREATE POLICY "Users can insert own API usage"
  ON public.api_usage_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users cannot update or delete (usage is append-only)
-- This ensures data integrity for tracking purposes

