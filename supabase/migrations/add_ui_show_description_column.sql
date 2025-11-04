-- Add ui_show_description column to admin_settings table
-- This column controls whether the description section is visible in ItemView components
-- Default is false (hidden), but admins can toggle it on for testing purposes

ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS ui_show_description BOOLEAN DEFAULT false;

-- Update the existing admin settings row to include the new column
UPDATE admin_settings
SET ui_show_description = false
WHERE id = '00000000-0000-0000-0000-000000000001';
