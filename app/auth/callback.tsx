import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/services/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('🔍 Auth callback received:', params);

    // Handle the OAuth callback
    const handleAuthCallback = async () => {
      try {
        // The OAuth flow should automatically handle the callback
        // We just need to wait for the session to be established
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Auth callback error:', error);
          // Redirect to auth screen on error
          router.replace('/auth');
          return;
        }

        if (session) {
          console.log('✅ Auth callback successful, user:', session.user.email);
          // Redirect to main app
          router.replace('/(tabs)');
        } else {
          console.log('ℹ️ No session found, redirecting to auth');
          router.replace('/auth');
        }
      } catch (error) {
        console.error('❌ Auth callback exception:', error);
        router.replace('/auth');
      }
    };

    handleAuthCallback();
  }, [params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
});
