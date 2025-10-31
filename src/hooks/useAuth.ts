import { useEffect, useRef } from 'react';
import { router, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, auth } from '../services/supabase';
import { authActions, authStore } from '../stores';
import { syncService } from '../services/syncService';
import { realtimeSyncService } from '../services/realtimeSync';
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

// Global flag to ensure auth initialization happens only once
let isAuthInitialized = false;

export function useAuth() {
  // Direct access to Legend-State observables
  const isAuthenticated = authStore.isAuthenticated.get();
  const isLoading = authStore.isLoading.get();
  const user = authStore.user.get();
  const segments = useSegments();

  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (isAuthInitialized || hasInitialized.current) {
      console.log('🚀 useAuth: Already initialized, skipping...');
      return;
    }

    isAuthInitialized = true;
    hasInitialized.current = true;
    
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

          // Load user settings from cloud FIRST
          console.log('⚙️ Loading user settings from cloud...');
          await userSettingsActions.loadSettings().catch(error => {
            console.error('Failed to load user settings:', error);
          });

          // Load admin settings (global settings for all users)
          console.log('🔧 Loading admin settings...');
          await adminSettingsActions.loadSettings().catch(error => {
            console.error('Failed to load admin settings:', error);
          });

          // Load AI settings AFTER user settings are loaded
          console.log('🤖 Loading AI settings...');
          await aiSettingsActions.loadSettings().catch(error => {
            console.error('Failed to load AI settings:', error);
          });

          // Trigger sync for existing session
          console.log('🔄 Starting sync for existing session...');
          syncService.forceSync().catch(error => {
            console.error('Failed to sync for existing session:', error);
          });

          // Start real-time sync
          console.log('📡 Starting real-time sync for existing session...');
          realtimeSyncService.start().catch(error => {
            console.error('Failed to start real-time sync:', error);
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

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in successfully!');
          authActions.setUser({
            id: session.user.id,
            email: session.user.email || '',
          });
          authActions.setSession(session);
          authActions.setLoading(false);

          // Load user settings from cloud FIRST
          console.log('⚙️ Loading user settings from cloud...');
          await userSettingsActions.loadSettings().catch(error => {
            console.error('Failed to load user settings:', error);
          });

          // Load admin settings (global settings for all users)
          console.log('🔧 Loading admin settings...');
          await adminSettingsActions.loadSettings().catch(error => {
            console.error('Failed to load admin settings:', error);
          });

          // Load AI settings AFTER user settings are loaded
          console.log('🤖 Loading AI settings...');
          await aiSettingsActions.loadSettings().catch(error => {
            console.error('Failed to load AI settings:', error);
          });

          // Trigger sync with Supabase after sign in
          console.log('🔄 Starting sync after sign in...');
          syncService.forceSync().catch(error => {
            console.error('Failed to sync after sign in:', error);
          });

          // Start real-time sync
          console.log('📡 Starting real-time sync after sign in...');
          realtimeSyncService.start().catch(error => {
            console.error('Failed to start real-time sync:', error);
          });

          // Navigate to home screen - the state change will trigger navigation
          console.log('🔄 User authenticated, state updated');
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');

          // Stop real-time sync
          console.log('📡 Stopping real-time sync...');
          realtimeSyncService.stop().catch(error => {
            console.error('Failed to stop real-time sync:', error);
          });

          // Clear all user data from AsyncStorage
          console.log('🧹 Clearing all user data from storage...');
          try {
            await AsyncStorage.multiRemove([
              STORAGE_KEYS.ITEMS,
              STORAGE_KEYS.SPACES,
              STORAGE_KEYS.ITEM_SPACES,
              STORAGE_KEYS.ITEM_METADATA,
              STORAGE_KEYS.ITEM_TYPE_METADATA,
              STORAGE_KEYS.OFFLINE_QUEUE,
              STORAGE_KEYS.VIDEO_TRANSCRIPTS,
              STORAGE_KEYS.SYNC_STATUS,
              STORAGE_KEYS.ITEM_CHATS,
              STORAGE_KEYS.CHAT_MESSAGES,
              STORAGE_KEYS.AI_SETTINGS,
              STORAGE_KEYS.AI_MODELS,
              STORAGE_KEYS.FILTERS,
              STORAGE_KEYS.USER_SETTINGS,
              STORAGE_KEYS.ADMIN_SETTINGS,
            ]);
            console.log('✅ Cleared all user data from storage');
          } catch (error) {
            console.error('❌ Error clearing storage:', error);
          }

          // Reset all stores to initial state
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

          // Reset auth store
          authActions.reset();
          authActions.setLoading(false);

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

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
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

      // Stop real-time sync before signing out
      console.log('📡 Stopping real-time sync...');
      await realtimeSyncService.stop();

      await auth.signOut();
      console.log('🚪 Sign out completed');

      // Fallback: proactively clear local state and storage in case event is delayed
      try {
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.ITEMS,
          STORAGE_KEYS.SPACES,
          STORAGE_KEYS.ITEM_SPACES,
          STORAGE_KEYS.ITEM_METADATA,
          STORAGE_KEYS.ITEM_TYPE_METADATA,
          STORAGE_KEYS.OFFLINE_QUEUE,
          STORAGE_KEYS.VIDEO_TRANSCRIPTS,
          STORAGE_KEYS.SYNC_STATUS,
          STORAGE_KEYS.ITEM_CHATS,
          STORAGE_KEYS.CHAT_MESSAGES,
          STORAGE_KEYS.AI_SETTINGS,
          STORAGE_KEYS.AI_MODELS,
          STORAGE_KEYS.FILTERS,
          STORAGE_KEYS.USER_SETTINGS,
          STORAGE_KEYS.ADMIN_SETTINGS,
        ]);
      } catch (err) {
        // swallow
      }

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

      authActions.reset();
      authActions.setLoading(false);
    } catch (error) {
      console.error('❌ Error signing out:', error);
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
