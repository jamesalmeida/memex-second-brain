-- Add youtube_use_thumbnail column to admin_settings table
-- This column controls whether YouTube videos show as thumbnails with play buttons
-- instead of embedded WebView players in the YouTubeItemView component
-- Default is false (use WebView embed), but admins can toggle it on when embeds fail

ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS youtube_use_thumbnail BOOLEAN DEFAULT false;

-- Update the existing admin settings row to include the new column
UPDATE admin_settings
SET youtube_use_thumbnail = false
WHERE id = '00000000-0000-0000-0000-000000000001';
