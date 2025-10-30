-- Add ui_radial_actions column to user_settings table
-- This column stores the user's selected radial action menu buttons (1-3 actions)

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS ui_radial_actions JSONB DEFAULT '["chat", "share", "archive"]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.user_settings.ui_radial_actions IS 'Array of 1-3 action IDs for the radial action menu (chat, share, archive, delete, move)';
