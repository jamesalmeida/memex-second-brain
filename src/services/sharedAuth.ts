import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { KEYCHAIN_CONFIG } from '../config/keychain';

/**
 * Shared authentication service using iOS Keychain with Access Groups
 *
 * Stores minimal auth credentials (access_token, refresh_token, user_id) in iOS Keychain
 * with an access group that allows both the main app and share extension to access them.
 *
 * This is the recommended Apple approach for sharing credentials between app targets.
 * More secure than FileSystem as it uses hardware-backed encryption.
 */

interface SharedAuthData {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_at?: number;
}

/**
 * Save minimal auth to shared Keychain
 * Accessible by both main app and share extension via Keychain Access Group
 *
 * Called by the main app when user signs in or session refreshes
 */
export const saveSharedAuth = async (session: any): Promise<void> => {
  if (Platform.OS !== 'ios') {
    console.warn('[SharedAuth] Keychain sharing only supported on iOS');
    return;
  }

  try {
    // Extract minimal auth data from Supabase session
    const authData: SharedAuthData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: session.user.id,
      expires_at: session.expires_at,
    };

    const payload = JSON.stringify(authData);

    // Check size limit (SecureStore has a 2048-byte limit per key)
    if (payload.length > 2048) {
      console.error('[SharedAuth] Session too large for SecureStore:', payload.length, 'bytes');
      console.error('[SharedAuth] Maximum allowed: 2048 bytes');
      return;
    }

    // Save to Keychain with access group
    await SecureStore.setItemAsync(
      KEYCHAIN_CONFIG.SESSION_KEY,
      payload,
      { accessGroup: KEYCHAIN_CONFIG.ACCESS_GROUP }
    );

    console.log('[SharedAuth] ✅ Saved auth to shared Keychain');
  } catch (error) {
    console.error('[SharedAuth] Error saving to Keychain:', error);
  }
};

/**
 * Get auth from shared Keychain
 * Returns null if not found or expired
 *
 * Called by the share extension to authenticate Supabase calls
 */
export const getSharedAuth = async (): Promise<SharedAuthData | null> => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    // Read from Keychain with access group
    const payload = await SecureStore.getItemAsync(
      KEYCHAIN_CONFIG.SESSION_KEY,
      { accessGroup: KEYCHAIN_CONFIG.ACCESS_GROUP }
    );

    if (!payload) {
      console.log('[SharedAuth] No auth in Keychain');
      return null;
    }

    const authData: SharedAuthData = JSON.parse(payload);

    // Check if token is expired (with 60 second buffer)
    if (authData.expires_at) {
      const now = Date.now() / 1000;
      if (authData.expires_at < now - 60) {
        console.log('[SharedAuth] Token expired');
        return null;
      }
    }

    console.log('[SharedAuth] ✅ Read auth from shared Keychain');
    return authData;
  } catch (error) {
    console.error('[SharedAuth] Error reading from Keychain:', error);
    return null;
  }
};

/**
 * Clear auth from shared Keychain
 * Called by the main app when user signs out
 */
export const clearSharedAuth = async (): Promise<void> => {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    await SecureStore.deleteItemAsync(
      KEYCHAIN_CONFIG.SESSION_KEY,
      { accessGroup: KEYCHAIN_CONFIG.ACCESS_GROUP }
    );
    console.log('[SharedAuth] ✅ Cleared auth from Keychain');
  } catch (error) {
    // Ignore error if item doesn't exist
    const errorMessage = error?.message || '';
    if (errorMessage.includes('not found') || errorMessage.includes('No such')) {
      console.log('[SharedAuth] No auth to clear (already empty)');
    } else {
      console.error('[SharedAuth] Error clearing Keychain:', error);
    }
  }
};
