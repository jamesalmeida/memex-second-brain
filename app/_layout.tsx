import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { observer, useObservable } from '@legendapp/state/react';
import { authStore, themeStore } from '../src/stores';
import { useAuth } from '../src/hooks/useAuth';

const RootLayoutContent = observer(() => {
  // Initialize auth - but only once due to the global flag in useAuth
  useAuth();
  
  const isLoading = authStore.isLoading.get();
  const isAuthenticated = authStore.isAuthenticated.get();
  const isDarkMode = themeStore.isDarkMode.get();
  const isThemeLoading = themeStore.isLoading.get();

  console.log('📱 Root layout rendering:', { isLoading, isAuthenticated, isDarkMode, isThemeLoading, timestamp: Date.now() });

  // Show loading spinner while checking auth or theme
  if (isLoading || isThemeLoading) {
    console.log('⏳ SHOWING LOADING SCREEN - auth or theme loading');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#000000' : '#ffffff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 20, color: isDarkMode ? '#AAA' : '#666', fontSize: 16 }}>
          Checking authentication...
        </Text>
        <Text style={{ marginTop: 10, color: isDarkMode ? '#777' : '#999', fontSize: 12 }}>
          Loading: {isLoading ? 'true' : 'false'}, Auth: {isAuthenticated ? 'true' : 'false'}
        </Text>
      </View>
    );
  }

  console.log('✅ LOADING COMPLETE - Current route should be determined by auth state');
  console.log('🔍 Auth state:', { isAuthenticated, isLoading });

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#000000' : '#ffffff' }}>
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
      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </View>
  );
});

export default function RootLayout() {
  console.log('🏗️ Root layout component rendered');
  return <RootLayoutContent />;
}
