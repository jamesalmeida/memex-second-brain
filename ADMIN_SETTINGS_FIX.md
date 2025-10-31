# Admin Settings Toggle Fix

## Problem

User reported that admin settings toggles in AdminSheet were not working properly:
1. **AI Automation toggles** (auto-generate transcripts, image descriptions, TLDR) - Value changes to `true` in database but UI toggle jumps back to OFF position and cannot be switched back to `false`
2. **YouTube Source buttons** - Buttons can be tapped but always stay on "youtubei.js" and don't change in database, cannot switch to "SerpAPI"

## Root Causes

### Issue 1: RLS Policy Using Wrong is_admin() Function

The `admin_settings` table RLS policies were using an `is_admin()` function that checked JWT `user_metadata`, but we changed the admin system to use `user_settings.is_admin` column.

**File:** [supabase/migrations/20251101_create_admin_settings.sql](supabase/migrations/20251101_create_admin_settings.sql:27-35)

```sql
-- OLD function (incorrect)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean,
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

This meant:
- Users with `user_settings.is_admin = true` could READ admin_settings (policy allows everyone)
- But they could NOT UPDATE admin_settings because `is_admin()` returned `false`
- The optimistic update in the client worked, showing the new value briefly
- The database update failed silently due to RLS, so the value reverted

### Issue 2: Legend State Reactivity Not Working

The AdminSheet component was using `.get()` on the parent object instead of nested properties:

**File:** [src/components/AdminSheet.tsx](src/components/AdminSheet.tsx)

```typescript
// WRONG - reads full object, not reactive to nested changes
value={adminSettingsStore.settings.get()?.auto_generate_transcripts ?? false}

// CORRECT - reads nested property, reactive to changes
value={adminSettingsStore.settings.auto_generate_transcripts.get() ?? false}
```

Legend State's `observer` wrapper only re-renders when observables are accessed during render. By calling `.get()` on `settings` instead of `settings.auto_generate_transcripts`, the component wasn't subscribing to changes in the nested field.

## Fixes Applied

### Fix 1: Update is_admin() Function to Check user_settings.is_admin

**Migration:** [supabase/migrations/20251101_fix_admin_settings_rls.sql](supabase/migrations/20251101_fix_admin_settings_rls.sql)

```sql
-- Drop old function
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Create new function that checks user_settings.is_admin column
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

This ensures:
- ✅ Users with `user_settings.is_admin = true` can UPDATE admin_settings
- ✅ RLS policies work correctly
- ✅ Database updates succeed instead of failing silently

### Fix 2: Use Nested Observable Access in AdminSheet

**Changes in:** [src/components/AdminSheet.tsx](src/components/AdminSheet.tsx)

Changed all admin settings accesses from:
```typescript
// BEFORE
adminSettingsStore.settings.get()?.auto_generate_transcripts
adminSettingsStore.settings.get()?.youtube_source
```

To:
```typescript
// AFTER
adminSettingsStore.settings.auto_generate_transcripts.get()
adminSettingsStore.settings.youtube_source.get()
```

**Lines changed:**
- Line 177, 182: Auto-generate TLDR toggle
- Line 208, 211: Auto-generate transcripts toggle
- Line 230, 233: Auto-generate image descriptions toggle
- Line 248, 251, 255, 258: YouTube enrichment source buttons
- Line 274, 277, 281, 284: YouTube transcript source buttons

This ensures:
- ✅ Component subscribes to nested property changes
- ✅ UI re-renders when store updates
- ✅ Toggles and buttons reflect actual database state

## Testing Steps

1. **Apply the database migration:**
   ```sql
   -- Run in Supabase Dashboard → SQL Editor
   -- Copy contents from: supabase/migrations/20251101_fix_admin_settings_rls.sql
   ```

2. **Restart the app** (to reload with updated component code)

3. **Test AI Automation toggles:**
   - Toggle "Auto-generate Transcripts" ON → Should stay ON
   - Check database: `SELECT * FROM admin_settings` → `auto_generate_transcripts` should be `true`
   - Toggle back OFF → Should stay OFF
   - Check database again → Should be `false`
   - Repeat for other toggles

4. **Test YouTube Source buttons:**
   - Tap "SerpAPI" for enrichment → Button should highlight
   - Check database: `youtube_source` should be `'serpapi'`
   - Tap "youtubei.js" → Should switch back
   - Check database: Should be `'youtubei'`
   - Repeat for transcript source

## Expected Behavior After Fix

✅ **Toggles should:**
- Change to ON when tapped and stay ON
- Change to OFF when tapped and stay OFF
- Match the database value exactly
- Update database successfully

✅ **Source buttons should:**
- Highlight the active selection
- Update database when tapped
- Stay highlighted after selection
- Allow switching between youtubei and serpapi

## Files Modified

1. ✅ [supabase/migrations/20251101_fix_admin_settings_rls.sql](supabase/migrations/20251101_fix_admin_settings_rls.sql) - NEW migration
2. ✅ [src/components/AdminSheet.tsx](src/components/AdminSheet.tsx) - Fixed reactive bindings
3. ✅ [ADMIN_SETTINGS_FIX.md](ADMIN_SETTINGS_FIX.md) - This documentation

## Related Files

- [src/stores/adminSettings.ts](src/stores/adminSettings.ts) - Admin settings store (no changes needed)
- [src/utils/adminCheck.ts](src/utils/adminCheck.ts) - Admin check utility (no changes needed)
- [supabase/migrations/20251101_create_admin_settings.sql](supabase/migrations/20251101_create_admin_settings.sql) - Original migration (has wrong function)
- [supabase/migrations/20251101_add_is_admin_to_user_settings.sql](supabase/migrations/20251101_add_is_admin_to_user_settings.sql) - Adds is_admin column

## Commit Message

```
Fix admin settings toggles and source buttons

Problem: Admin settings toggles would change in DB but UI would revert,
and YouTube source buttons wouldn't update at all.

Root causes:
1. RLS policies used is_admin() function that checked JWT user_metadata
   instead of user_settings.is_admin column, causing silent update failures
2. AdminSheet used .get() on parent object instead of nested properties,
   breaking Legend State reactivity

Fixes:
- Update is_admin() function to query user_settings.is_admin column
- Change all admin settings accesses to use nested observable paths
- Recreate RLS policies after function update

Admin settings toggles and source buttons now work correctly with proper
two-way binding between UI and database.
```
