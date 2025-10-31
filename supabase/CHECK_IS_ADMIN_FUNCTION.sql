-- ========================================
-- CHECK IF is_admin() FUNCTION IS CORRECT
-- ========================================
-- This will return results you can see in the output

-- 1. Get the function definition
SELECT pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'is_admin';

-- 2. Check if it references the correct table
SELECT
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%user_settings%' THEN '✅ CORRECT - Checks user_settings.is_admin'
    WHEN pg_get_functiondef(oid) LIKE '%user_metadata%' THEN '❌ WRONG - Still checking JWT user_metadata'
    ELSE '⚠️ UNKNOWN - Unexpected function definition'
  END AS status,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%user_settings%' THEN 'Function is correct! Toggles should work now.'
    ELSE 'Function is still wrong. RLS will block updates.'
  END AS message
FROM pg_proc
WHERE proname = 'is_admin';

-- 3. Count the policies
SELECT
  COUNT(*) AS policy_count,
  CASE
    WHEN COUNT(*) = 4 THEN '✅ All 4 policies exist'
    ELSE '❌ Missing policies (should be 4)'
  END AS status
FROM pg_policies
WHERE tablename = 'admin_settings';

-- 4. List all policies
SELECT
  policyname,
  cmd AS operation,
  CASE
    WHEN policyname LIKE '%read%' THEN '✅ Allows everyone to read'
    WHEN policyname LIKE '%insert%' THEN '🔒 Only admins can insert'
    WHEN policyname LIKE '%update%' THEN '🔒 Only admins can update'
    WHEN policyname LIKE '%delete%' THEN '🔒 Only admins can delete'
  END AS description
FROM pg_policies
WHERE tablename = 'admin_settings'
ORDER BY policyname;
