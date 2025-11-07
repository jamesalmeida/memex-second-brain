import { useEffect, useRef } from 'react';
import { router, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, auth } from '../services/supabase';
import { authActions, authStore } from '../stores';
import { syncService } from '../services/syncService';
import { realtimeSyncService } from '../services/realtimeSync';
import { pendingItemsProcessor } from '../services/pendingItemsProcessor';
import { getItemsFromSharedQueue, clearSharedQueue } from '../services/sharedItemQueue';
import { saveSharedAuth, clearSharedAuth } from '../services/sharedAuth';
import { STORAGE_KEYS } from '../constants';
import { itemsActions } from '../stores/items';
import { spacesActions } from '../stores/spaces';
import { itemSpacesActions } from '../stores/itemSpaces';
import { itemMetadataActions } from '../stores/itemMetadata';
import { itemTypeMetadataActions } from '../stores/itemTypeMetadata';
import { offlineQueueActions } from '../stores/offlineQueue';
import { itemChatsActions } from '../stores/itemChats';
import { chatMessagesActions } from '../stores/chatMessages';
import { aiSettingsActions } from '../stores/aiSettings';
import { filterActions } from '../stores/filter';
import { userSettingsActions } from '../stores/userSettings';
import { adminSettingsActions } from '../stores/adminSettings';

/**
 * Clears all authentication-related state, storage, and data stores.
 * This is the single source of truth for cleanup logic during sign-out.
 */
async function clearAuthState() {
  console.log('🧹 Clearing all auth state and user data...');

  // Stop real-time sync
  console.log('📡 Stopping real-time sync...');
  await realtimeSyncService.stop().catch(error => {
    console.error('Failed to stop real-time sync:', error);
  });

  // Clear all user data from AsyncStorage INCLUDING Supabase auth session
  console.log('🧹 Clearing all user data from storage...');
  try {
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('🔑 All AsyncStorage keys:', allKeys);

    // Filter out theme preference (we want to keep that across logout)
    const keysToRemove = allKeys.filter(key => key !== 'theme');

    // Remove everything except theme
    await AsyncStorage.multiRemove(keysToRemove);
    console.log('✅ Cleared all user data from storage (including Supabase session)');

    // Extra safety: Explicitly clear any Supabase session keys that might remain
    // These follow the pattern: sb-<project-ref>-auth-token
    const supabaseKeys = allKeys.filter(key => key.startsWith('sb-') && key.includes('-auth-token'));
    if (supabaseKeys.length > 0) {
      console.log('🔑 Found Supabase session keys to clear:', supabaseKeys);
      await AsyncStorage.multiRemove(supabaseKeys);
      console.log('✅ Explicitly cleared Supabase session keys');
    }
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
  }

  // Reset all stores to initial state
  console.log('🔄 Resetting all data stores...');
  itemsActions.clearAll();
  spacesActions.clearAll();
  itemSpacesActions.reset();
  itemMetadataActions.reset();
  itemTypeMetadataActions.reset();
  offlineQueueActions.reset();
  await itemChatsActions.clearAll();
  await chatMessagesActions.clearAll();
  await aiSettingsActions.clearAll();
  await filterActions.clearAll();
  await userSettingsActions.clearSettings();
  // Note: adminSettings are global (not user-specific) so we don't clear them

  // Clear shared auth for share extension
  console.log('🔐 Clearing shared auth...');
  await clearSharedAuth().catch(error => {
    console.error('Failed to clear shared auth:', error);
  });

  // Reset auth store
  console.log('🔐 Resetting auth store...');
  authActions.reset();
  authActions.setLoading(false);

  console.log('✅ Auth state cleared successfully');
}

export function useAuth() {
  // Direct access to Legend-State observables
  const isAuthenticated = authStore.isAuthenticated.get();
  const isLoading = authStore.isLoading.get();
  const user = authStore.user.get();
  const segments = useSegments();

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isInitializing = useRef(false);
  const signOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Prevent concurrent initializations, but allow re-initialization after cleanup
    if (isInitializing.current) {
      console.log('🚀 useAuth: Currently initializing, skipping...');
      return;
    }

    // If we already have an active subscription, don't create another
    if (subscriptionRef.current) {
      console.log('🚀 useAuth: Subscription already active, skipping...');
      return;
    }

    isInitializing.current = true;
    
    console.log('🚀 useAuth hook initialized');

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔍 Getting initial session...');
        const { data: { session }, error } = await auth.getSession();

        if (error) {
          console.error('❌ Error getting session:', error);
        } else {
          console.log('✅ Session check completed');
        }

        if (session?.user) {
          console.log('✅ User found in session:', session.user.email);
          authActions.setUser({
            id: session.user.id,
            email: session.user.email || '',
          });
          authActions.setSession(session);

          // Save auth to shared container for share extension
          console.log('🔐 Saving auth to shared container...');
          await saveSharedAuth(session).catch(error => {
            console.error('Failed to save shared auth:', error);
          });

          // Load user settings from cloud FIRST (with timeout)
          console.log('⚙️ Loading user settings from cloud...');
          await Promise.race([
            userSettingsActions.loadSettings(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('User settings load timeout')), 10000))
          ]).catch(error => {
            console.error('Failed to load user settings:', error);
          });

          // Load admin settings (global settings for all users) (with timeout)
          console.log('🔧 Loading admin settings...');
          await Promise.race([
            adminSettingsActions.loadSettings(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Admin settings load timeout')), 10000))
          ]).catch(error => {
            console.error('Failed to load admin settings:', error);
          });

          // Load AI settings AFTER user settings are loaded (with timeout)
          console.log('🤖 Loading AI settings...');
          await Promise.race([
            aiSettingsActions.loadSettings(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI settings load timeout')), 10000))
          ]).catch(error => {
            console.error('Failed to load AI settings:', error);
          });

          // Import items from share extension queue
          console.log('📥 Checking for items from share extension...');
          try {
            const sharedItems = await getItemsFromSharedQueue();
            if (sharedItems.length > 0) {
              console.log(`📥 Found ${sharedItems.length} items from share extension, importing...`);
              for (const item of sharedItems) {
                // Update user_id if it was 'pending'
                if (item.user_id === 'pending') {
                  item.user_id = session.user.id;
                }
                // Add item with sync
                await itemsActions.addItemWithSync(item);
                console.log(`✅ Imported item: ${item.title}`);
              }
              // Clear the queue after successful import
              await clearSharedQueue();
              console.log('✅ Cleared share extension queue');
            }
          } catch (error) {
            console.error('❌ Error importing items from share extension:', error);
          }

          // Trigger sync for existing session
          console.log('🔄 Starting sync for existing session...');
          try {
            syncService.forceSync().catch(error => {
              console.error('Failed to sync for existing session:', error);
            });
          } catch (error) {
            console.error('❌ Error calling forceSync:', error);
          }

          // Start real-time sync (must happen regardless of sync status)
          console.log('📡 Starting real-time sync for existing session...');
          realtimeSyncService.start().catch(error => {
            console.error('❌ Failed to start real-time sync:', error);
          });

          // Process pending items from Share Extension in background
          console.log('⚙️ Starting automatic processing of pending items...');
          pendingItemsProcessor.processPendingItemsOnStartup().catch(error => {
            console.error('❌ Failed to process pending items:', error);
          });
        } else {
          console.log('ℹ️ No user in session (expected for first-time users)');
        }
      } catch (error) {
        console.error('❌ Error in getInitialSession:', error);
      } finally {
        console.log('🔄 Setting loading to false');
        authActions.setLoading(false);
        console.log('🔄 Loading state after setting:', authStore.isLoading.get());
      }
    };

    // Add a timeout to ensure loading doesn't get stuck
    const loadingTimeout = setTimeout(() => {
      console.log('⏰ Loading timeout reached, forcing loading to false');
      authActions.setLoading(false);
      console.log('⏰ Loading state after timeout:', authStore.isLoading.get());
    }, 10000); // 10 second timeout

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        isInitializing.current = false; // Initialization complete once listener is set up

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in successfully!');
          authActions.setUser({
            id: session.user.id,
            email: session.user.email || '',
          });
          authActions.setSession(session);
          authActions.setLoading(false);

          // Save auth to shared container for share extension
          console.log('🔐 Saving auth to shared container...');
          await saveSharedAuth(session).catch(error => {
            console.error('Failed to save shared auth:', error);
          });

          // Load user settings from cloud FIRST (with timeout)
          console.log('⚙️ Loading user settings from cloud...');
          await Promise.race([
            userSettingsActions.loadSettings(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('User settings load timeout')), 10000))
          ]).catch(error => {
            console.error('Failed to load user settings:', error);
          });

          // Load admin settings (global settings for all users) (with timeout)
          console.log('🔧 Loading admin settings...');
          await Promise.race([
            adminSettingsActions.loadSettings(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Admin settings load timeout')), 10000))
          ]).catch(error => {
            console.error('Failed to load admin settings:', error);
          });

          // Load AI settings AFTER user settings are loaded (with timeout)
          console.log('🤖 Loading AI settings...');
          await Promise.race([
            aiSettingsActions.loadSettings(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI settings load timeout')), 10000))
          ]).catch(error => {
            console.error('Failed to load AI settings:', error);
          });

          // Trigger sync with Supabase after sign in
          console.log('🔄 Starting sync after sign in...');
          try {
            syncService.forceSync().catch(error => {
              console.error('Failed to sync after sign in:', error);
            });
          } catch (error) {
            console.error('❌ Error calling forceSync:', error);
          }

          // Start real-time sync (must happen regardless of sync status)
          console.log('📡 Starting real-time sync after sign in...');
          realtimeSyncService.start().catch(error => {
            console.error('❌ Failed to start real-time sync:', error);
          });

          // Process pending items from Share Extension in background
          console.log('⚙️ Starting automatic processing of pending items...');
          pendingItemsProcessor.processPendingItemsOnStartup().catch(error => {
            console.error('❌ Failed to process pending items:', error);
          });

          // Navigate to home screen - the state change will trigger navigation
          console.log('🔄 User authenticated, state updated');
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out - SIGNED_OUT event received');

          // Clear the sign-out timeout if it was set (since we got the event successfully)
          if (signOutTimeoutRef.current) {
            clearTimeout(signOutTimeoutRef.current);
            signOutTimeoutRef.current = null;
            console.log('✅ Cleared sign-out timeout (event received successfully)');
          }

          // Use consolidated cleanup function
          await clearAuthState();

          // Navigate to auth screen - the state change will trigger navigation
          console.log('🔄 User signed out, state updated');
        } else if (event === 'TOKEN_REFRESHED' && session) {
          console.log('🔄 Token refreshed');
          authActions.setSession(session);
        } else if (event === 'INITIAL_SESSION') {
          console.log('🔍 Initial session event:', session?.user?.email || 'no user');
          if (session?.user) {
            authActions.setUser({
              id: session.user.id,
              email: session.user.email || '',
            });
            authActions.setSession(session);
          }
          authActions.setLoading(false);
        }
      }
    );

    // Store the subscription reference
    subscriptionRef.current = subscription;
    isInitializing.current = false;

    return () => {
      console.log('🧹 useAuth cleanup: Unsubscribing from auth listener');
      clearTimeout(loadingTimeout);
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (signOutTimeoutRef.current) {
        clearTimeout(signOutTimeoutRef.current);
        signOutTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle navigation based on auth state changes
  useEffect(() => {
    if (isLoading) {
      console.log('🔄 Navigation check: Still loading, skipping navigation');
      return; // Don't navigate while loading
    }

    const inAuthGroup = segments[0] === 'auth';
    const inTabsGroup = segments[0] === '(tabs)';

    console.log('🔄 Navigation check:', { 
      isAuthenticated, 
      isLoading, 
      segments: segments.join('/'),
      inAuthGroup,
      inTabsGroup,
      shouldGoToTabs: isAuthenticated && !inTabsGroup,
      shouldGoToAuth: !isAuthenticated && !inAuthGroup
    });

    if (isAuthenticated && !inTabsGroup) {
      console.log('✅ Navigating authenticated user to tabs');
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup) {
      console.log('✅ Navigating unauthenticated user to auth');
      router.replace('/auth');
    } else {
      console.log('✅ User is already on the correct screen');
    }
  }, [isAuthenticated, isLoading, segments]);

  const signOut = async () => {
    try {
      console.log('🚪 Starting sign out process...');
      console.log('🔍 Current auth state:', { isAuthenticated, user: user?.email });
      console.log('🔍 Subscription active?', !!subscriptionRef.current);

      // Call Supabase signOut - this should trigger the SIGNED_OUT event
      console.log('📤 Calling Supabase auth.signOut()...');
      const { error } = await auth.signOut();

      if (error) {
        console.error('❌ Supabase signOut returned error:', error);
        throw error;
      }

      console.log('✅ Supabase signOut() completed successfully');

      // Set a timeout to force cleanup if the SIGNED_OUT event doesn't fire
      // This is especially important in dev builds with React Strict Mode
      console.log('⏱️ Setting 3-second timeout for fallback cleanup...');
      signOutTimeoutRef.current = setTimeout(async () => {
        console.warn('⚠️ SIGNED_OUT event not received within 3 seconds, forcing cleanup...');
        console.warn('⚠️ This indicates the auth listener may be dead (React Strict Mode issue)');

        // Force cleanup since the event listener might be dead (React Strict Mode issue)
        await clearAuthState();

        // Force navigation to auth screen
        console.log('🔄 Forcing navigation to auth screen...');
        router.replace('/auth');

        signOutTimeoutRef.current = null;
      }, 3000); // 3 second timeout

      console.log('✅ Sign-out timeout set - waiting for SIGNED_OUT event or timeout...');

    } catch (error) {
      console.error('❌ Exception caught during sign out:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));

      // Even if signOut fails, try to clean up local state
      console.log('🧹 Attempting cleanup despite sign-out error...');
      try {
        await clearAuthState();
        console.log('✅ Cleanup completed, navigating to auth...');
        router.replace('/auth');
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
        // Last resort: force navigation even if cleanup partially fails
        console.log('🔄 Last resort: forcing navigation to auth...');
        router.replace('/auth');
      }
    }
  };

  // Return reactive values
  return {
    user,
    isAuthenticated,
    isLoading,
    signOut,
  };
}
