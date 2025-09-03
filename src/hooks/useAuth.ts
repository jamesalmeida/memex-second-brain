import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase, auth } from '../services/supabase';
import { authActions, authStore } from '../stores';

export function useAuth() {
  // Direct access to Legend-State observables
  const isAuthenticated = authStore.isAuthenticated.get();
  const isLoading = authStore.isLoading.get();
  const user = authStore.user.get();

  useEffect(() => {
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



    // DIAGNOSTIC: Periodically check for session changes
    const sessionChecker = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !authStore.isAuthenticated.get()) {
        console.log('🚨 DIAGNOSTIC: Found session but not authenticated!', session.user?.email);
      }
    }, 5000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        console.log('🔍 DIAGNOSTIC: Full auth event details:', {
          event,
          hasSession: !!session,
          hasUser: !!session?.user,
          accessToken: session?.access_token ? 'present' : 'missing',
          refreshToken: session?.refresh_token ? 'present' : 'missing'
        });

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in successfully!');
          authActions.setUser({
            id: session.user.id,
            email: session.user.email || '',
          });
          authActions.setSession(session);
          authActions.setLoading(false);

          // Navigate to home screen
          console.log('🔄 Navigating to main app...');
          router.replace('/(tabs)');
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
          authActions.reset();
          authActions.setLoading(false);

          // Navigate to auth screen
          router.replace('/auth');
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
      clearInterval(sessionChecker);
      subscription.unsubscribe();
    };
  }, []);

  // Redirect logic
  useEffect(() => {
    console.log('🔄 Redirect logic running:', {
      isLoading,
      isAuthenticated,
      pathname: router.pathname || 'undefined',
      currentTime: new Date().toISOString()
    });

    if (!isLoading) {
      const currentPath = router.pathname || '';
      console.log('🔍 Current pathname:', currentPath);
      
      if (isAuthenticated) {
        // User is authenticated, ensure we're on the main app
        if (currentPath.startsWith('/auth') || currentPath === '') {
          console.log('🔄 Redirecting authenticated user to tabs');
          router.replace('/(tabs)');
        }
      } else {
        // User is not authenticated, ensure we're on auth screen
        if (!currentPath.startsWith('/auth')) {
          console.log('🔄 Redirecting unauthenticated user to auth');
          console.log('🚨 SHOULD REDIRECT TO AUTH SCREEN');
          router.replace('/auth');
        }
      }
    }
  }, [isAuthenticated, isLoading]);

  const signOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
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
