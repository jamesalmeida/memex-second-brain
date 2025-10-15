// Import YouTube polyfills first - must be at the top
import '../src/services/youtube';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, Dimensions, StyleSheet } from 'react-native';
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
import { useDeviceType } from '../src/utils/device';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 100; // Approximate height of bottom navigation including safe area
const DRAWER_WIDTH = 280;

const RootLayoutContent = observer(() => {
  // Initialize auth - but only once due to the global flag in useAuth
  useAuth();

  // Get device type and orientation
  const { isPersistentDrawer } = useDeviceType();

  // Get drawer context
  const { drawerRef, isDrawerOpen, closeDrawer, openDrawer, currentView, isDrawerVisible } = useDrawer();

  // Dynamic swipe edge width: keep small so left column taps aren't intercepted
  const swipeEdgeWidth = currentView === 'everything' ? 30 : 50;

  // Debug flag to show swipe area
  const showDebugSwipeArea = false;

  const isLoading = authStore.isLoading.get();
  const isAuthenticated = authStore.isAuthenticated.get();
  const isDarkMode = themeStore.isDarkMode.get();
  const isThemeLoading = themeStore.isLoading.get();

  console.log('📱 Root layout rendering:', { isLoading, isAuthenticated, isDarkMode, isThemeLoading, isPersistentDrawer, timestamp: Date.now() });

  // Navigation is handled centrally in useAuth; avoid duplicate redirects here

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

  // Main content component (used in both drawer and split-view modes)
  const MainContent = () => (
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
          pointerEvents: 'box-none',
        }}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
      />

      {/* Debug: Show swipe detection area */}
      {showDebugSwipeArea && !isPersistentDrawer && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: swipeEdgeWidth,
            backgroundColor: 'rgba(255, 0, 0, 0.2)',
            pointerEvents: 'none',
          }}
        >
          <Text
            style={{
              position: 'absolute',
              top: '50%',
              left: 10,
              color: 'red',
              fontSize: 10,
              fontWeight: 'bold',
              transform: [{ rotate: '-90deg' }],
            }}
          >
            {swipeEdgeWidth}px
          </Text>
        </View>
      )}
    </View>
  );

  // iPad Landscape: Persistent Split-View Drawer
  if (isPersistentDrawer) {
    return (
      <View style={styles.splitViewContainer}>
        {/* Persistent Sidebar Drawer */}
        {isDrawerVisible && (
          <View 
            style={[
              styles.persistentDrawer,
              { 
                backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
                borderRightWidth: StyleSheet.hairlineWidth,
                borderRightColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }
            ]}
          >
            <DrawerContentView onClose={closeDrawer} />
          </View>
        )}
        
        {/* Main Content Area */}
        <View style={styles.mainContentArea}>
          <MainContent />
        </View>
      </View>
    );
  }

  // Mobile & iPad Portrait: Standard Drawer with Swipe
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
        width: DRAWER_WIDTH,
      }}
      overlayStyle={{
        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      }}
      swipeEnabled={true}
      swipeEdgeWidth={swipeEdgeWidth}
      renderDrawerContent={() => {
        console.log('🎨 [RootLayout] renderDrawerContent called');
        return <DrawerContentView onClose={closeDrawer} />;
      }}
    >
      <MainContent />
    </Drawer>
  );
});

const styles = StyleSheet.create({
  splitViewContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  persistentDrawer: {
    width: DRAWER_WIDTH,
  },
  mainContentArea: {
    flex: 1,
  },
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
