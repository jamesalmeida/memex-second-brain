-- Add is_admin column to user_settings table
-- Simple approach: use existing user_settings table instead of creating user_roles

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.user_settings.is_admin IS 'Admin flag - set to true for admin users who can access admin panel';

-- To set a user as admin, run:
-- UPDATE public.user_settings
-- SET is_admin = true
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
