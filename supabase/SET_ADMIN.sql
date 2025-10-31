-- ========================================
-- SET YOURSELF AS ADMIN
-- ========================================
-- Copy and paste this into Supabase Dashboard → SQL Editor → Run

-- Step 1: Apply the migration to add is_admin column (if not already done)
-- This is idempotent - safe to run multiple times
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.user_settings.is_admin IS 'Admin flag - set to true for admin users who can access admin panel';

-- Step 2: Set your user as admin
-- Replace 'jimmyplaysdrums@gmail.com' with your email if different
UPDATE public.user_settings
SET is_admin = true
WHERE user_id = (
  SELECT id
  FROM auth.users
  WHERE email = 'jimmyplaysdrums@gmail.com'
);

-- Step 3: Verify it worked
SELECT
  u.email,
  us.is_admin,
  us.updated_at,
  CASE
    WHEN us.is_admin = true THEN '✅ YOU ARE NOW ADMIN'
    ELSE '❌ Not admin yet'
  END as status
FROM auth.users u
JOIN public.user_settings us ON u.id = us.user_id
WHERE u.email = 'jimmyplaysdrums@gmail.com';

-- You should see your email with is_admin = true in the results
