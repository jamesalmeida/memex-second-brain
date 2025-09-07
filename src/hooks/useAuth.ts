import { useEffect, useRef } from 'react';
import { router, useSegments } from 'expo-router';
import { supabase, auth } from '../services/supabase';
import { authActions, authStore } from '../stores';
import { syncActions } from '../stores/syncStore';

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
          
          // Trigger sync for existing session
          console.log('🔄 Starting sync for existing session...');
          syncActions.forceSync().catch(error => {
            console.error('Failed to sync for existing session:', error);
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

          // Trigger sync with Supabase after sign in
          console.log('🔄 Starting sync after sign in...');
          syncActions.forceSync().catch(error => {
            console.error('Failed to sync after sign in:', error);
          });

          // Navigate to home screen - the state change will trigger navigation
          console.log('🔄 User authenticated, state updated');
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
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
      await auth.signOut();
      console.log('🚪 Sign out completed');
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
