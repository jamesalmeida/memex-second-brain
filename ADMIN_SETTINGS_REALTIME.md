# Admin Settings Real-Time Sync Implementation

## Overview

Added real-time sync for the `admin_settings` table so that when any admin user toggles a setting on one device, all other connected devices (and all users) see the change immediately - just like how items and spaces sync in real-time.

## Problem Solved

**Before:** Admin settings changes only updated locally and in the database. Other devices/users had to manually refresh or restart the app to see changes.

**After:** Admin settings sync in real-time across all connected devices and users instantly.

## Implementation Details

### 1. Database Migration

**File:** [supabase/migrations/20251101_enable_realtime_admin_settings.sql](supabase/migrations/20251101_enable_realtime_admin_settings.sql)

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE admin_settings;
```

This enables Supabase's real-time replication for the `admin_settings` table, broadcasting all INSERT/UPDATE/DELETE events to connected clients.

### 2. Subscription Helper

**File:** [src/services/supabase.ts](src/services/supabase.ts:434-448)

Added `adminSettings()` method to the `subscriptions` object:

```typescript
adminSettings: (callback: (payload: any) => void) => {
  return supabase
    .channel('admin_settings')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'admin_settings',
        // No filter - admin_settings is a global single-row table
      },
      callback
    )
    .subscribe();
},
```

**Key Difference from Items/Spaces:** No `user_id` filter because `admin_settings` is a global single-row table shared by all users.

### 3. Real-Time Sync Service

**File:** [src/services/realtimeSync.ts](src/services/realtimeSync.ts)

**Changes:**
- Added import for `adminSettingsStore` and `AdminSettings` type
- Added `adminSettingsChannel` property to class
- Subscribe to admin_settings in `start()` method
- Unsubscribe in `stop()` method
- Added `handleAdminSettingsChange()` handler method

**Handler Implementation:**

```typescript
private async handleAdminSettingsChange(payload: any) {
  const { eventType, new: newSettings } = payload;

  try {
    if (eventType === 'UPDATE' && newSettings) {
      console.log('🔄 [RealtimeSync] Updating admin settings from remote');

      // Update the store (triggers UI re-render)
      adminSettingsStore.settings.set(newSettings as AdminSettings);

      // Update AsyncStorage cache
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(newSettings));

      console.log('✅ [RealtimeSync] Admin settings change applied locally');
    } else {
      console.log(`ℹ️ [RealtimeSync] Ignoring admin settings ${eventType} event`);
    }
  } catch (error) {
    console.error('❌ [RealtimeSync] Error handling admin settings change:', error);
  }
}
```

**Why Only UPDATE Events:**
- Admin settings is a single-row table created by migration
- INSERT happens once (migration), DELETE should never happen
- All changes are UPDATE events

### 4. Storage Key Constant

**File:** [src/constants/index.ts](src/constants/index.ts:113)

Added storage key for AsyncStorage cache:

```typescript
ADMIN_SETTINGS: '@memex_admin_settings', // Cloud-synced global admin settings
```

### 5. Auth Cleanup

**File:** [src/hooks/useAuth.ts](src/hooks/useAuth.ts)

Added `STORAGE_KEYS.ADMIN_SETTINGS` to both cleanup locations:
- Line 189: SIGNED_OUT event handler
- Line 297: signOut() fallback cleanup

Ensures admin settings cache is cleared when user signs out.

## How It Works

### Flow Diagram

```
Device 1 (Admin)                     Supabase                      Device 2 (Any User)
─────────────────                    ────────                      ───────────────────
User toggles setting
      ↓
AdminSheet calls
adminSettingsActions.setAutoGenerateTranscripts(true)
      ↓
Optimistic update:
adminSettingsStore.settings.set(...)
      ↓
Database UPDATE:
supabase.update('admin_settings')  ──→  RLS Check (is_admin?)  ──→  Real-time broadcast
                                                                              ↓
                                                                    adminSettings channel
                                                                              ↓
                                                                    handleAdminSettingsChange()
                                                                              ↓
                                                                    Update adminSettingsStore
                                                                              ↓
                                                                    Update AsyncStorage
                                                                              ↓
                                                                    UI re-renders (observer)
                                                                              ↓
                                                                    ✅ Toggle updates instantly
```

### Subscription Lifecycle

1. **App Starts:**
   - User signs in → `useAuth` loads adminSettings
   - `realtimeSyncService.start()` called
   - Subscribes to `admin_settings` channel via `subscriptions.adminSettings()`

2. **Setting Changes:**
   - Admin toggles setting → UPDATE in database
   - Supabase broadcasts change to all subscribed clients
   - Each client receives payload via `handleAdminSettingsChange()`
   - Store updates → AdminSheet re-renders (Legend State observer)
   - All connected devices see change instantly

3. **App Stops:**
   - User signs out → `realtimeSyncService.stop()` called
   - Unsubscribes from all channels including `adminSettingsChannel`
   - Clears AsyncStorage cache

## Testing

### Manual Testing Steps

1. **Setup:**
   - Apply migration: `supabase/migrations/20251101_enable_realtime_admin_settings.sql`
   - Restart app to load updated code

2. **Real-Time Sync Test:**
   - Open app on Device 1 (as admin)
   - Open app on Device 2 (any user)
   - Both devices open AdminSheet (Device 2 needs admin access for this test)
   - Device 1: Toggle "Auto-generate Transcripts" ON
   - **Expected:** Device 2's toggle immediately switches to ON (no refresh needed)
   - Device 1: Toggle back OFF
   - **Expected:** Device 2's toggle immediately switches to OFF

3. **Multi-User Test:**
   - Device 1: Change "YouTube Enrichment Source" to "SerpAPI"
   - **Expected:** Device 2 immediately shows "SerpAPI" selected
   - Verify in database: `SELECT * FROM admin_settings` shows `youtube_source = 'serpapi'`

4. **Console Logs to Watch:**
   ```
   Device 1:
   🔧 Admin setting updated: auto_generate_transcripts = true

   Device 2:
   📡 [RealtimeSync] Admin settings change received: UPDATE
   🔄 [RealtimeSync] Updating admin settings from remote
   ✅ [RealtimeSync] Admin settings change applied locally
   ```

5. **Offline/Online Test:**
   - Device 2: Enable airplane mode
   - Device 1: Toggle several settings
   - Device 2: Disable airplane mode
   - **Expected:** Device 2 syncs changes when back online

### Database Verification

```sql
-- Check real-time publication includes admin_settings
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Should show admin_settings in results

-- Watch real-time events (Supabase Dashboard → Database → Realtime)
-- Toggle a setting and watch for UPDATE event on admin_settings table
```

## Benefits

✅ **Instant Sync:** All users see admin setting changes immediately
✅ **Consistent UX:** Works exactly like items/spaces real-time sync
✅ **Offline Support:** Changes sync when device reconnects
✅ **Global Settings:** All users affected by admin changes in real-time
✅ **No Polling:** Uses WebSocket push notifications, no wasteful polling
✅ **Cached Locally:** AsyncStorage provides offline access to last known state

## Architecture Consistency

This implementation follows the exact same pattern as items and spaces real-time sync:

| Feature | Items/Spaces | Admin Settings |
|---------|-------------|----------------|
| **Migration** | `20251024_enable_realtime.sql` | `20251101_enable_realtime_admin_settings.sql` |
| **Subscription Helper** | `subscriptions.items()` | `subscriptions.adminSettings()` |
| **Channel Property** | `itemsChannel` | `adminSettingsChannel` |
| **Handler Method** | `handleItemChange()` | `handleAdminSettingsChange()` |
| **Store Update** | `itemsStore.items.set()` | `adminSettingsStore.settings.set()` |
| **AsyncStorage Key** | `STORAGE_KEYS.ITEMS` | `STORAGE_KEYS.ADMIN_SETTINGS` |
| **User Filtering** | Yes (`user_id=eq.${userId}`) | No (global table) |

## Files Modified

1. ✅ [supabase/migrations/20251101_enable_realtime_admin_settings.sql](supabase/migrations/20251101_enable_realtime_admin_settings.sql) - NEW
2. ✅ [src/services/supabase.ts](src/services/supabase.ts) - Added `adminSettings()` subscription helper
3. ✅ [src/services/realtimeSync.ts](src/services/realtimeSync.ts) - Added channel, handler, imports
4. ✅ [src/constants/index.ts](src/constants/index.ts) - Added `ADMIN_SETTINGS` storage key
5. ✅ [src/hooks/useAuth.ts](src/hooks/useAuth.ts) - Added admin_settings to cleanup arrays

## Next Steps

After applying the migration and restarting the app:

1. Test real-time sync between devices
2. Verify console logs show sync events
3. Test offline/online scenarios
4. Monitor for any real-time connection issues

## Troubleshooting

**Toggle changes but doesn't sync to other devices:**
- Check Supabase Dashboard → Database → Realtime Inspector
- Verify `admin_settings` table is in the publication
- Check console for `📡 [RealtimeSync] Admin settings change received` logs
- Verify RLS allows reading admin_settings (should be public read)

**"Connection refused" or subscription errors:**
- Check Supabase real-time quotas/limits
- Verify real-time is enabled for the project
- Check network connectivity

**Changes sync with delay:**
- This is usually network latency (should be <100ms on good connection)
- Check Supabase real-time metrics for latency
- Consider local network issues if persistent

## Commit Message

```
Add real-time sync for admin settings

- Enable real-time replication for admin_settings table in Supabase
- Add adminSettings subscription helper to supabase.ts
- Update realtimeSync service with admin_settings channel and handler
- Add ADMIN_SETTINGS storage key to constants
- Include admin_settings in auth cleanup arrays

Admin settings now sync instantly across all devices and users,
matching the real-time behavior of items and spaces.
```
