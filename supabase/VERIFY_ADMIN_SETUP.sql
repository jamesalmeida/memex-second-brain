-- ========================================
-- VERIFY ADMIN SETUP
-- ========================================
-- Run this in Supabase SQL Editor to verify admin system is configured correctly

-- 1. Check if is_admin column exists in user_settings
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
  AND column_name = 'is_admin';
-- Expected: Should show is_admin column with type boolean, default false

-- 2. Check if you are marked as admin
SELECT
  u.email,
  us.is_admin,
  us.user_id
FROM auth.users u
JOIN public.user_settings us ON u.id = us.user_id
WHERE u.email = 'jimmyplaysdrums@gmail.com';
-- Expected: is_admin should be TRUE

-- 3. Test the is_admin() function
SELECT public.is_admin();
-- Expected: Should return TRUE if you're logged in as admin
-- Note: This only works if you're testing from an authenticated context

-- 4. Check admin_settings table structure
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'admin_settings'
ORDER BY ordinal_position;
-- Expected: Should show all admin_settings columns

-- 5. Check current admin_settings values
SELECT * FROM public.admin_settings;
-- Expected: Should show one row with current settings

-- 6. Check RLS policies on admin_settings
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'admin_settings'
ORDER BY policyname;
-- Expected: Should show 4 policies (read, insert, update, delete)

-- 7. Verify real-time is enabled for admin_settings
SELECT *
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'admin_settings';
-- Expected: Should show admin_settings in the publication

-- 8. Test if you can update admin_settings (run this if logged in as admin)
-- WARNING: This will actually change a setting, change it back after testing
UPDATE public.admin_settings
SET auto_generate_transcripts = NOT auto_generate_transcripts
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
RETURNING *;
-- Expected: Should succeed and return the updated row
-- If it fails with RLS error, the is_admin() function is not working

-- 9. Check the is_admin() function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'is_admin';
-- Expected: Should show function that queries user_settings.is_admin
-- NOT auth.jwt() -> 'user_metadata'

-- 10. Summary - If any of these fail, note which ones:
DO $$
DECLARE
  has_column BOOLEAN;
  has_admin BOOLEAN;
  has_realtime BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Check column
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_settings'
      AND column_name = 'is_admin'
  ) INTO has_column;

  -- Check admin user
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.user_settings us ON u.id = us.user_id
    WHERE u.email = 'jimmyplaysdrums@gmail.com'
      AND us.is_admin = true
  ) INTO has_admin;

  -- Check realtime
  SELECT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'admin_settings'
  ) INTO has_realtime;

  -- Check policies
  SELECT COUNT(*)
  FROM pg_policies
  WHERE tablename = 'admin_settings'
  INTO policy_count;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADMIN SETUP VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ is_admin column exists: %', CASE WHEN has_column THEN 'YES ✅' ELSE 'NO ❌' END;
  RAISE NOTICE '✓ Admin user configured: %', CASE WHEN has_admin THEN 'YES ✅' ELSE 'NO ❌' END;
  RAISE NOTICE '✓ Real-time enabled: %', CASE WHEN has_realtime THEN 'YES ✅' ELSE 'NO ❌' END;
  RAISE NOTICE '✓ RLS policies count: % %', policy_count, CASE WHEN policy_count = 4 THEN '✅' ELSE '❌ (should be 4)' END;
  RAISE NOTICE '';

  IF has_column AND has_admin AND has_realtime AND policy_count = 4 THEN
    RAISE NOTICE '🎉 All checks passed! Admin system is properly configured.';
  ELSE
    RAISE NOTICE '⚠️  Some checks failed. Review the results above.';
    IF NOT has_column THEN
      RAISE NOTICE '   → Run migration: 20251101_add_is_admin_to_user_settings.sql';
    END IF;
    IF NOT has_admin THEN
      RAISE NOTICE '   → Run: SET_ADMIN.sql to mark yourself as admin';
    END IF;
    IF NOT has_realtime THEN
      RAISE NOTICE '   → Run migration: 20251101_enable_realtime_admin_settings.sql';
    END IF;
    IF policy_count != 4 THEN
      RAISE NOTICE '   → Run migration: 20251101_fix_admin_settings_rls.sql';
    END IF;
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
