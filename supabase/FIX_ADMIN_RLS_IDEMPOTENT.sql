-- ========================================
-- FIX ADMIN RLS (IDEMPOTENT VERSION)
-- ========================================
-- Safe to run multiple times - will only update what needs updating

-- Step 1: Drop all existing policies explicitly
DROP POLICY IF EXISTS "Anyone can read admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Only admins can insert admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Only admins can update admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Only admins can delete admin settings" ON public.admin_settings;

-- Step 2: Drop and recreate the is_admin() function
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT is_admin
      FROM public.user_settings
      WHERE user_id = auth.uid()
    ),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Checks if current user has admin privileges via user_settings.is_admin column';

-- Step 3: Recreate all policies
CREATE POLICY "Anyone can read admin settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert admin settings"
  ON public.admin_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can update admin settings"
  ON public.admin_settings
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can delete admin settings"
  ON public.admin_settings
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Step 4: Verify everything is set up correctly
DO $$
DECLARE
  func_def TEXT;
  uses_user_settings BOOLEAN;
BEGIN
  -- Get the function definition
  SELECT pg_get_functiondef(oid) INTO func_def
  FROM pg_proc
  WHERE proname = 'is_admin';

  -- Check if it references user_settings (not JWT)
  uses_user_settings := func_def LIKE '%user_settings%';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADMIN RLS FIX COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policies dropped and recreated';
  RAISE NOTICE '✅ is_admin() function updated';
  RAISE NOTICE '✅ Function checks user_settings: %',
    CASE WHEN uses_user_settings THEN 'YES ✅' ELSE 'NO ❌ (STILL BROKEN!)' END;
  RAISE NOTICE '';

  IF uses_user_settings THEN
    RAISE NOTICE '🎉 SUCCESS! Admin toggles should now update the database.';
  ELSE
    RAISE NOTICE '⚠️  WARNING! Function still checking wrong source. Contact support.';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Reload your app';
  RAISE NOTICE '2. Toggle an admin setting';
  RAISE NOTICE '3. Check console for: 🔧 ✅ Admin setting updated successfully';
  RAISE NOTICE '4. Verify database value changed';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
