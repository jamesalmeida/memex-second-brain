-- Create admin_settings table with single global row
-- This table stores global admin settings that apply to ALL users in the system
-- Only one row should ever exist (enforced by CHECK constraint)

CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,

  -- AI Automation Settings
  auto_generate_transcripts BOOLEAN DEFAULT false,
  auto_generate_image_descriptions BOOLEAN DEFAULT false,
  auto_generate_tldr BOOLEAN DEFAULT false,

  -- API Source Preferences
  youtube_source TEXT DEFAULT 'youtubei' CHECK (youtube_source IN ('youtubei', 'serpapi')),
  youtube_transcript_source TEXT DEFAULT 'youtubei' CHECK (youtube_transcript_source IN ('youtubei', 'serpapi')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure only one row exists (fixed UUID)
  CONSTRAINT single_admin_settings_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Create helper function to check if user is admin
-- Checks the is_admin flag in user_metadata from JWT claims
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean,
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read admin settings (all users need to read global settings)
CREATE POLICY "Anyone can read admin settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert
CREATE POLICY "Only admins can insert admin settings"
  ON public.admin_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Only admins can update
CREATE POLICY "Only admins can update admin settings"
  ON public.admin_settings
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can delete (though we should never delete the single row)
CREATE POLICY "Only admins can delete admin settings"
  ON public.admin_settings
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_settings_updated_at();

-- Insert the single global row with defaults (all false)
INSERT INTO public.admin_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.admin_settings IS 'Global admin settings that apply to all users. Only one row should exist with fixed UUID.';
COMMENT ON COLUMN public.admin_settings.auto_generate_transcripts IS 'Automatically fetch video transcripts when saving items (applies to all users)';
COMMENT ON COLUMN public.admin_settings.auto_generate_image_descriptions IS 'Automatically describe images when saving items (applies to all users)';
COMMENT ON COLUMN public.admin_settings.auto_generate_tldr IS 'Automatically generate TLDR summaries when adding new items (applies to all users)';
COMMENT ON COLUMN public.admin_settings.youtube_source IS 'YouTube metadata source: youtubei (direct) or serpapi (API service)';
COMMENT ON COLUMN public.admin_settings.youtube_transcript_source IS 'YouTube transcript source: youtubei (direct) or serpapi (API service)';
