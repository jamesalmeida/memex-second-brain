# Troubleshooting Admin Settings Toggles

## Problem
Admin settings toggles don't update the database in Supabase.

## Diagnostic Steps

### Step 1: Check Console Logs

When you toggle a setting, look for these logs in your React Native console:

**What you SHOULD see (success):**
```
🔧 Attempting to update admin setting: auto_generate_transcripts = true for user: <your-user-id>
🔧 ✅ Admin setting updated successfully: auto_generate_transcripts = true Response: [...]
```

**What indicates a problem:**
```
🔧 ❌ ERROR updating admin setting: {
  field: 'auto_generate_transcripts',
  error: 'new row violates row-level security policy',
  code: '42501',
  ...
}
```

### Step 2: Verify Database Setup

Run this SQL script in Supabase Dashboard → SQL Editor:

**Copy/paste entire contents of:** [supabase/VERIFY_ADMIN_SETUP.sql](supabase/VERIFY_ADMIN_SETUP.sql)

This will check:
- ✅ `is_admin` column exists in `user_settings`
- ✅ Your user has `is_admin = true`
- ✅ RLS policies are correct
- ✅ Real-time is enabled
- ✅ `is_admin()` function is correct

### Step 3: Apply Missing Migrations

If the verification script shows failures, apply migrations in this order:

**1. Add is_admin column** (if missing):
```sql
-- Copy/paste: supabase/migrations/20251101_add_is_admin_to_user_settings.sql
```

**2. Set yourself as admin** (if not admin):
```sql
-- Copy/paste: supabase/SET_ADMIN.sql
```

**3. Fix RLS policies** (CRITICAL - this is likely the issue):
```sql
-- Copy/paste: supabase/migrations/20251101_fix_admin_settings_rls.sql
```

**4. Enable real-time** (if not enabled):
```sql
-- Copy/paste: supabase/migrations/20251101_enable_realtime_admin_settings.sql
```

### Step 4: Test the is_admin() Function

Run this in Supabase SQL Editor:

```sql
-- Check the function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'is_admin';
```

**Expected result:**
```sql
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
```

**If you see this instead (OLD/WRONG):**
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean,
    false
  );
END;
```

**Fix:** Run [supabase/migrations/20251101_fix_admin_settings_rls.sql](supabase/migrations/20251101_fix_admin_settings_rls.sql)

### Step 5: Test Direct Update

Try updating directly via SQL:

```sql
-- Test if RLS allows you to update
UPDATE public.admin_settings
SET auto_generate_transcripts = true
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
RETURNING *;
```

**Success:** Returns the updated row
**Failure:** Error message like "new row violates row-level security policy"

If this fails, the `is_admin()` function is definitely the problem.

### Step 6: Check User Settings Table

Verify your user has the admin flag:

```sql
SELECT
  u.email,
  us.is_admin,
  us.user_id
FROM auth.users u
JOIN public.user_settings us ON u.id = us.user_id
WHERE u.email = 'jimmyplaysdrums@gmail.com';
```

**Expected:**
```
email                     | is_admin | user_id
--------------------------|----------|----------
jimmyplaysdrums@gmail.com | true     | <uuid>
```

If `is_admin` is `false` or `NULL`, run [supabase/SET_ADMIN.sql](supabase/SET_ADMIN.sql)

## Common Issues and Fixes

### Issue 1: RLS Error (42501)

**Error in console:**
```
code: '42501'
error: 'new row violates row-level security policy'
```

**Cause:** The `is_admin()` function is checking JWT `user_metadata` instead of `user_settings.is_admin`

**Fix:** Run [supabase/migrations/20251101_fix_admin_settings_rls.sql](supabase/migrations/20251101_fix_admin_settings_rls.sql)

### Issue 2: Column 'is_admin' Does Not Exist

**Error in console:**
```
column "is_admin" does not exist
```

**Cause:** Migration to add `is_admin` column wasn't applied

**Fix:** Run [supabase/migrations/20251101_add_is_admin_to_user_settings.sql](supabase/migrations/20251101_add_is_admin_to_user_settings.sql)

### Issue 3: No Error But No Update

**Symptom:** Toggle works in UI, no error logged, but database value doesn't change

**Possible causes:**
1. Optimistic update succeeded but database update silently failed
2. Check if `.select()` was added to the update query (should return data)
3. RLS might be silently blocking without throwing error

**Fix:**
- Check enhanced console logs (you should see detailed error now)
- Run VERIFY_ADMIN_SETUP.sql to check all components

### Issue 4: Updates But Doesn't Sync to Other Devices

**Symptom:** Database updates correctly but other devices don't see changes in real-time

**Possible causes:**
1. Real-time not enabled for `admin_settings` table
2. RealtimeSync service not subscribed
3. Network/connection issues

**Fix:**
1. Run [supabase/migrations/20251101_enable_realtime_admin_settings.sql](supabase/migrations/20251101_enable_realtime_admin_settings.sql)
2. Restart app to reinitialize subscriptions
3. Check console for: `📡 [RealtimeSync] Admin settings change received`

## Quick Fix Checklist

Run these in order:

- [ ] 1. Run [VERIFY_ADMIN_SETUP.sql](supabase/VERIFY_ADMIN_SETUP.sql) - identify what's broken
- [ ] 2. Run [20251101_fix_admin_settings_rls.sql](supabase/migrations/20251101_fix_admin_settings_rls.sql) - fix is_admin() function
- [ ] 3. Run [SET_ADMIN.sql](supabase/SET_ADMIN.sql) - ensure you're marked as admin
- [ ] 4. Restart app completely
- [ ] 5. Toggle a setting and watch console logs
- [ ] 6. Check database to confirm value changed

## Expected Console Output (Success)

When everything works correctly, toggling a setting should show:

```
🔧 Attempting to update admin setting: auto_generate_transcripts = true for user: abc123...
🔧 ✅ Admin setting updated successfully: auto_generate_transcripts = true Response: [{
  id: '00000000-0000-0000-0000-000000000001',
  auto_generate_transcripts: true,
  auto_generate_image_descriptions: false,
  ...
}]
```

And on other devices:
```
📡 [RealtimeSync] Admin settings change received: UPDATE
🔄 [RealtimeSync] Updating admin settings from remote
✅ [RealtimeSync] Admin settings change applied locally
```

## Still Not Working?

If you've completed all steps and it's still not working:

1. **Share the console logs** - Look for the enhanced error details
2. **Share the verification script output** - Run VERIFY_ADMIN_SETUP.sql
3. **Check Supabase logs** - Dashboard → Logs → Filter for errors
4. **Verify migrations were applied** - Check Supabase Dashboard → Database → Migrations

The most likely issue is that the `is_admin()` function wasn't updated to check `user_settings.is_admin` column. The fix is critical: [20251101_fix_admin_settings_rls.sql](supabase/migrations/20251101_fix_admin_settings_rls.sql)
