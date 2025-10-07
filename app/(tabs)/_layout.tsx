import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Keyboard, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from '@legendapp/state/react';
import BottomSheet, { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { usePathname } from 'expo-router';
import { Button as ButtonPrimitive, Host, Circle, Image } from '@expo/ui/swift-ui';
import { frame, glassEffect, onTapGesture, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { themeStore } from '../../src/stores/theme';
import { chatUIStore } from '../../src/stores/chatUI';
import { useRadialMenu } from '../../src/contexts/RadialMenuContext';
import BottomNavigation from '../../src/components/BottomNavigation';
import SettingsSheet from '../../src/components/SettingsSheet';
import AddItemSheet from '../../src/components/AddItemSheet';
import CreateSpaceSheet from '../../src/components/CreateSpaceSheet';
import ChatSheet from '../../src/components/ChatSheet';
import HomeScreen from './index';
import SpacesScreen from './spaces';
import { Item } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TabLayout = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [currentView, setCurrentView] = useState<'everything' | 'spaces'>('everything');
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isExpandedItemOpen, setIsExpandedItemOpen] = useState(false);

  // Get radial menu state to disable swipe gesture
  const { shouldDisableScroll } = useRadialMenu();

  // Animation value for sliding views using reanimated
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  // Bottom sheet refs
  const settingsSheetRef = useRef<BottomSheet>(null);
  const addItemSheetRef = useRef<any>(null);
  const createSpaceSheetRef = useRef<BottomSheet>(null);
  const chatSheetRef = useRef<BottomSheet>(null);

  // Dismiss keyboard on mount
  useEffect(() => {
    Keyboard.dismiss();
  }, []);

  // Sync currentView with actual route from expo-router
  useEffect(() => {
    console.log('📍 Route changed - pathname:', pathname, 'currentView:', currentView);
    if (pathname.includes('/spaces') && currentView !== 'spaces') {
      console.log('✅ Switching to spaces view');
      setCurrentView('spaces');
    } else if (pathname === '/(tabs)' || pathname === '/' && currentView !== 'everything') {
      console.log('✅ Switching to everything view');
      setCurrentView('everything');
    }
  }, [pathname]);

  // Watch chatUI store and control chat sheet
  const isChatOpen = chatUIStore.isOpen.get();
  useEffect(() => {
    console.log('🔔 [TabLayout] isChatOpen changed to:', isChatOpen);
    console.log('🔔 [TabLayout] chatSheetRef.current exists?', !!chatSheetRef.current);
    if (isChatOpen) {
      console.log('🔔 [TabLayout] Calling expand()...');
      chatSheetRef.current?.expand();
    } else {
      console.log('🔔 [TabLayout] Calling close()...');
      chatSheetRef.current?.close();
    }
  }, [isChatOpen]);

  // Log when isExpandedItemOpen changes
  useEffect(() => {
    console.log('🏠 [TabLayout] isExpandedItemOpen state changed to:', isExpandedItemOpen);
  }, [isExpandedItemOpen]);

  const handleSettingsPress = () => {
    if (isSettingsOpen) {
      settingsSheetRef.current?.close();
      setIsSettingsOpen(false);
    } else {
      // Close add sheets if open before opening settings
      if (isAddSheetOpen) {
        addItemSheetRef.current?.close();
        createSpaceSheetRef.current?.close();
        setIsAddSheetOpen(false);
      }
      settingsSheetRef.current?.expand();
      setIsSettingsOpen(true);
    }
  };

  const handleAddPress = () => {
    console.log('🏠🏠🏠 handleAddPress called');
    if (isAddSheetOpen) {
      // Close the open sheet
      addItemSheetRef.current?.close();
      createSpaceSheetRef.current?.close();
      setIsAddSheetOpen(false);
    } else {
      // Close settings sheet if open before opening add sheets
      if (isSettingsOpen) {
        settingsSheetRef.current?.close();
        setIsSettingsOpen(false);
      }
      // Show different sheet based on current view
      if (currentView === 'spaces' && !currentSpaceId) {
        createSpaceSheetRef.current?.snapToIndex(0);
      } else {
        // If we're in a space view, pass the space ID to pre-select it
        if (currentSpaceId) {
          addItemSheetRef.current?.openWithSpace(currentSpaceId);
        } else {
          addItemSheetRef.current?.snapToIndex(0);
        }
      }
      setIsAddSheetOpen(true);
    }
  };

  const handleViewChange = (view: 'everything' | 'spaces') => {
    console.log('🏠🏠🏠 handleViewChange called - setting currentView to:');
    // Close any open sheets when switching views
    if (isAddSheetOpen) {
      addItemSheetRef.current?.close();
      createSpaceSheetRef.current?.close();
      setIsAddSheetOpen(false);
    }
    if (isSettingsOpen) {
      settingsSheetRef.current?.close();
      setIsSettingsOpen(false);
    }

    // Animate the slide based on the view
    // const targetX = view === 'everything' ? 0 : -SCREEN_WIDTH;
    // translateX.value = withTiming(targetX, {
    //   duration: 250,
    //   easing: Easing.out(Easing.cubic),
    // });

    setCurrentView(view);
    console.log('🏠 [TabLayout] handleViewChange called - setting currentView to:', view);
  };

  // Pan gesture for swipe navigation
  const panGesture = Gesture.Pan()
    .enabled(!shouldDisableScroll) // Disable swipe when radial menu is active
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // Calculate new position with boundaries
      const newX = startX.value + event.translationX;
      // Clamp between -SCREEN_WIDTH (spaces) and 0 (everything)
      translateX.value = Math.max(-SCREEN_WIDTH, Math.min(0, newX));
    })
    .onEnd((event) => {
      const velocity = event.velocityX;
      const position = translateX.value;

      // Determine which view to snap to based on velocity and position
      let targetView: 'everything' | 'spaces';

      // If velocity is strong enough, use velocity to determine direction
      if (Math.abs(velocity) > 500) {
        targetView = velocity > 0 ? 'everything' : 'spaces';
      } else {
        // Otherwise use position (snap to nearest)
        targetView = position > -SCREEN_WIDTH / 2 ? 'everything' : 'spaces';
      }

      // Animate to target position
      const targetX = targetView === 'everything' ? 0 : -SCREEN_WIDTH;
      translateX.value = withTiming(targetX, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });

      // Update the view state
      if (targetView !== currentView) {
        runOnJS(setCurrentView)(targetView);
      }
    });

  // Animated style for the sliding container
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <BottomSheetModalProvider>
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        {/* Main Content - extends full screen */}
        <View style={styles.fullScreenContent}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.slidingContainer, animatedStyle]}>
              {/* Everything View */}
              <View style={styles.viewContainer} pointerEvents={currentView === 'everything' ? 'auto' : 'none'}>
                <HomeScreen
                  onExpandedItemOpen={() => {
                    console.log('🏠 [TabLayout] onExpandedItemOpen called - setting isExpandedItemOpen to true');
                    setIsExpandedItemOpen(true);
                  }}
                  onExpandedItemClose={() => {
                    console.log('🏠 [TabLayout] onExpandedItemClose called - setting isExpandedItemOpen to false');
                    setIsExpandedItemOpen(false);
                  }}
                />
              </View>

              {/* Spaces View */}
              <View style={styles.viewContainer} pointerEvents={currentView === 'spaces' ? 'auto' : 'none'}>
                <SpacesScreen onSpaceOpen={setCurrentSpaceId} onSpaceClose={() => setCurrentSpaceId(null)} />
              </View>
            </Animated.View>
          </GestureDetector>
        </View>

      {/* Liquid Glass Action Buttons */}
      {!isExpandedItemOpen && (
        <>
          {/* Hamburger Menu Button - Bottom Left */}
          <View
            style={[
              styles.glassButtonHost,
              styles.leftButton,
              { bottom: insets.bottom - 20 }
            ]}          >
            <Host style={{ width: 60, height: 60 }}>
              <Circle
                modifiers={[
                  frame({ width: 60, height: 60 }),
                  glassEffect({ glass: { variant: 'regular', interactive: true } }),
                  onTapGesture(handleSettingsPress)
                ]}
              >
                <Image
                  systemImage="line.3.horizontal"
                  modifiers={[
                    foregroundStyle(isDarkMode ? 'white' : 'black')
                  ]}
                />
              </Circle>
            </Host>
          </View>

          {/* Add Item Button - Bottom Right */}
          <View
            style={[
              styles.glassButtonHost,
              styles.rightButton,
              { bottom: insets.bottom - 20 }
            ]}
          >
            <Host style={{ width: 60, height: 60 }}>
              <Circle
                modifiers={[
                  frame({ width: 60, height: 60 }),
                  glassEffect({ glass: { variant: 'regular', interactive: true } }),
                  onTapGesture(handleAddPress)
                ]}
              >
                <Image
                  systemImage="plus"
                  modifiers={[
                    foregroundStyle('white')
                  ]}
                />
              </Circle>
            </Host>
          </View>
        </>
      )}

      {/* Native Tabs with Liquid Glass Effect */}
      {!isExpandedItemOpen && (
        <NativeTabs
          blurEffect={isDarkMode ? "systemChromeMaterialDark" : "systemChromeMaterial"}
          backgroundColor={isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"}
        >
          <NativeTabs.Trigger
            name="index"
            onPress={() => handleViewChange('everything')}
          >
            <Icon src={<VectorIcon family={MaterialIcons} name="grid-view" />} />
            <Label>Home</Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger
            name="spaces"
            onPress={() => handleViewChange('spaces')}
          >
            <Icon src={<VectorIcon family={MaterialIcons} name="folder" />} />
            <Label>Spaces</Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      )}

      {/* Bottom Sheets - Higher z-index to appear above expanded views */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500, pointerEvents: 'box-none' }}>
        <SettingsSheet
          ref={settingsSheetRef}
          onOpen={() => setIsSettingsOpen(true)}
          onClose={() => setIsSettingsOpen(false)}
        />
        <AddItemSheet
          ref={addItemSheetRef}
          preSelectedSpaceId={currentSpaceId}
          onOpen={() => setIsAddSheetOpen(true)}
          onClose={() => setIsAddSheetOpen(false)}
        />
        <CreateSpaceSheet
          ref={createSpaceSheetRef}
          onOpen={() => setIsAddSheetOpen(true)}
          onClose={() => setIsAddSheetOpen(false)}
        />
      </View>

      {/* Chat Sheet Modal - Renders on native layer above everything */}
      <ChatSheet
        ref={chatSheetRef}
      />
      </View>
    </BottomSheetModalProvider>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  fullScreenContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  slidingContainer: {
    flexDirection: 'row',
    width: SCREEN_WIDTH * 2,
    height: '100%',
  },
  viewContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  glassButtonHost: {
    position: 'absolute',
    width: 56,
    height: 56,
    zIndex: 1000,
  },
  leftButton: {
    left: 30,
  },
  rightButton: {
    right: 30,
  },
});

export default TabLayout;