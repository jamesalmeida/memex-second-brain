-- Drop unused AI automation columns from user_settings
-- These settings were moved to admin_settings table (global settings)
-- Migration created: 2025-11-01

-- Drop the columns that are no longer used
ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS ai_auto_transcripts,
  DROP COLUMN IF EXISTS ai_auto_image_descriptions;

-- Add comment to document the change
COMMENT ON TABLE public.user_settings IS 'User-specific settings. AI automation settings (auto transcripts, auto image descriptions) are now global admin settings in the admin_settings table.';
