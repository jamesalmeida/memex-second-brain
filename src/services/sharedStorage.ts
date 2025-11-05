import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

/**
 * Shared storage that works across iOS app targets (main app + share extension)
 * Uses MMKV with iOS App Groups to share data between targets
 *
 * This allows the main app and share extension to access the same Supabase session,
 * so users don't need to sign in separately in the share extension.
 */

// Create MMKV instance with App Group for iOS
// This allows both main app and share extension to access the same data
const storage = new MMKV({
  id: 'memex-shared-storage',
  ...(Platform.OS === 'ios' && {
    // Use App Group container on iOS - must match the app group in entitlements
    path: 'group.com.jamesalmeida.memex'
  })
});

/**
 * AsyncStorage-compatible wrapper for Supabase
 * Supabase expects async storage methods, but MMKV is synchronous,
 * so we wrap the sync calls in async functions
 */
export const sharedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = storage.getString(key);
      return value ?? null;
    } catch (error) {
      console.error('[SharedStorage] getItem error:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      storage.set(key, value);
    } catch (error) {
      console.error('[SharedStorage] setItem error:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      storage.delete(key);
    } catch (error) {
      console.error('[SharedStorage] removeItem error:', error);
    }
  },
};

// Export the raw MMKV instance for direct synchronous access if needed
export const mmkvStorage = storage;
