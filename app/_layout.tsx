// Import YouTube polyfills first - must be at the top
import '../src/services/youtube';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, Dimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { observer, useObservable } from '@legendapp/state/react';
import { useEffect, useState, useRef } from 'react';
import { Drawer } from 'react-native-drawer-layout';
import { authStore, themeStore } from '../src/stores';
import { useAuth } from '../src/hooks/useAuth';
import { RadialMenuProvider } from '../src/contexts/RadialMenuContext';
import { DrawerProvider, useDrawer } from '../src/contexts/DrawerContext';
import DrawerContentView from '../src/components/DrawerContent';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 100; // Approximate height of bottom navigation including safe area

const RootLayoutContent = observer(() => {
  // Initialize auth - but only once due to the global flag in useAuth
  useAuth();

  // Get drawer context
  const { drawerRef, isDrawerOpen, closeDrawer, openDrawer } = useDrawer();

  const isLoading = authStore.isLoading.get();
  const isAuthenticated = authStore.isAuthenticated.get();
  const isDarkMode = themeStore.isDarkMode.get();
  const isThemeLoading = themeStore.isLoading.get();

  console.log('📱 Root layout rendering:', { isLoading, isAuthenticated, isDarkMode, isThemeLoading, timestamp: Date.now() });

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isLoading && !isThemeLoading) {
      console.log('🔄 Root layout navigation check:', { isAuthenticated, isLoading });
      
      // Use setTimeout to ensure navigation happens after the Stack is rendered
      setTimeout(() => {
        if (isAuthenticated) {
          console.log('✅ Navigating to tabs from root layout');
          router.replace('/(tabs)');
        } else {
          console.log('✅ Navigating to auth from root layout');
          router.replace('/auth');
        }
      }, 0);
    }
  }, [isAuthenticated, isLoading, isThemeLoading]);

  // Show loading spinner while checking auth or theme
  if (isLoading || isThemeLoading) {
    console.log('⏳ SHOWING LOADING SCREEN - auth or theme loading');
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#000000' : '#ffffff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 20, color: isDarkMode ? '#AAA' : '#666', fontSize: 16 }}>
            Checking authentication...
          </Text>
          <Text style={{ marginTop: 10, color: isDarkMode ? '#777' : '#999', fontSize: 12 }}>
            Loading: {isLoading ? 'true' : 'false'}, Auth: {isAuthenticated ? 'true' : 'false'}
          </Text>
        </View>
        <StatusBar style={isDarkMode ? "light" : "dark"} />
      </SafeAreaView>
    );
  }

  console.log('✅ LOADING COMPLETE - Current route should be determined by auth state');
  console.log('🔍 Auth state:', { isAuthenticated, isLoading });

  return (
    <Drawer
      ref={drawerRef}
      open={isDrawerOpen}
      onOpen={() => {
        const timestamp = new Date().toISOString();
        console.log('📂 [RootLayout] Drawer onOpen callback fired at:', timestamp);
        console.log('📂 [RootLayout] Drawer opened - checking if this was from gesture or programmatic');
        console.trace();

        // Sync the drawer state with context when opened by gesture
        if (!isDrawerOpen) {
          console.log('📂 [RootLayout] Drawer opened by GESTURE - syncing context state');
          openDrawer();
        }
      }}
      onClose={() => {
        const timestamp = new Date().toISOString();
        console.log('📂 [RootLayout] Drawer onClose callback fired at:', timestamp);

        // Sync the drawer state with context when closed
        closeDrawer();
      }}
      drawerType="slide"
      drawerStyle={{
        backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
        width: 280,
      }}
      overlayStyle={{
        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      }}
      swipeEnabled={true}
      swipeEdgeWidth={50}
      renderDrawerContent={() => {
        console.log('🎨 [RootLayout] renderDrawerContent called');
        return <DrawerContentView onClose={closeDrawer} />;
      }}
    >
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

        {/* Gesture blocker for bottom tab area - prevents drawer swipe from interfering with tab taps */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: BOTTOM_TAB_HEIGHT,
            backgroundColor: 'transparent',
            pointerEvents: 'box-none', // Allow touches to pass through to tabs, but block gestures
          }}
          onStartShouldSetResponder={() => true} // Intercept touch events in this region
          onResponderTerminationRequest={() => false} // Don't let drawer steal these touches
        />
      </View>
    </Drawer>
  );
});

export default function RootLayout() {
  console.log('🏗️ Root layout component rendered');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DrawerProvider>
          <RadialMenuProvider>
            <RootLayoutContent />
          </RadialMenuProvider>
        </DrawerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
