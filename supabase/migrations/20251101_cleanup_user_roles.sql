-- ========================================
-- CLEANUP: Drop user_roles table and related objects
-- ========================================
-- This migration removes the abandoned user_roles approach
-- We now use user_settings.is_admin column instead (simpler, no RLS recursion)

-- Drop the is_admin() function first (it references the table)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Drop all policies on user_roles table
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Drop the user_roles table
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Verify cleanup
DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup complete!';
  RAISE NOTICE '   - user_roles table dropped';
  RAISE NOTICE '   - is_admin() function dropped';
  RAISE NOTICE '   - All related policies dropped';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Admin system now uses: user_settings.is_admin column';
END $$;
