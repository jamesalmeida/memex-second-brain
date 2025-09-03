import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { observer } from '@legendapp/state/react';
import { authStore } from '../src/stores';
import { useAuth } from '../src/hooks/useAuth';

const RootLayoutContent = observer(() => {
  // Initialize auth - but only once due to the global flag in useAuth
  useAuth();
  
  const isLoading = authStore.isLoading.get();
  const isAuthenticated = authStore.isAuthenticated.get();

  console.log('📱 Root layout rendering:', { isLoading, isAuthenticated, timestamp: Date.now() });

  // Show loading spinner while checking auth
  if (isLoading) {
    console.log('⏳ SHOWING LOADING SCREEN - isLoading is true');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 20, color: '#666', fontSize: 16 }}>
          Checking authentication...
        </Text>
        <Text style={{ marginTop: 10, color: '#999', fontSize: 12 }}>
          Loading: {isLoading ? 'true' : 'false'}, Auth: {isAuthenticated ? 'true' : 'false'}
        </Text>
      </View>
    );
  }

  console.log('✅ LOADING COMPLETE - Current route should be determined by auth state');
  console.log('🔍 Auth state:', { isAuthenticated, isLoading });

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="auth"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style="auto" />
    </View>
  );
});

export default function RootLayout() {
  console.log('🏗️ Root layout component rendered');
  return <RootLayoutContent />;
}
