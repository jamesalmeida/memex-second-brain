import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Keyboard, Dimensions, Share, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from '@legendapp/state/react';
import BottomSheet, { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { themeStore } from '../../src/stores/theme';
import { chatUIStore, chatUIActions } from '../../src/stores/chatUI';
import { useRadialMenu } from '../../src/contexts/RadialMenuContext';
import BottomNavigation from '../../src/components/BottomNavigation';
import SettingsSheet from '../../src/components/SettingsSheet';
import AddItemSheet from '../../src/components/AddItemSheet';
import CreateSpaceSheet from '../../src/components/CreateSpaceSheet';
import ChatSheet from '../../src/components/ChatSheet';
import FilterSheet from '../../src/components/FilterSheet';
import HomeScreen from './index';
import SpacesScreen from './spaces';
import { Item } from '../../src/types';
import { itemsActions } from '../../src/stores/items';
import ExpandedItemView from '../../src/components/ExpandedItemView';
import { expandedItemUIStore, expandedItemUIActions } from '../../src/stores/expandedItemUI';
import { useDrawer } from '../../src/contexts/DrawerContext';

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
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Get radial menu state to disable swipe gesture
  const { shouldDisableScroll } = useRadialMenu();

  // Register settings handler with drawer context
  const { registerSettingsHandler } = useDrawer();
  useEffect(() => {
    console.log('⚙️ [TabLayout] Registering settings handler with DrawerContext');
    registerSettingsHandler(handleSettingsPress);
  }, [registerSettingsHandler, handleSettingsPress]);

  // Animation value for sliding views using reanimated
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  // Bottom sheet refs
  const settingsSheetRef = useRef<BottomSheet>(null);
  const addItemSheetRef = useRef<any>(null);
  const createSpaceSheetRef = useRef<BottomSheet>(null);
  const chatSheetRef = useRef<BottomSheet>(null);
  const expandedItemSheetRef = useRef<BottomSheet>(null);
  const filterSheetRef = useRef<BottomSheet>(null);

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

  // Observe expandedItemUIStore to control overlayed ExpandedItemView and nav visibility
  useEffect(() => {
    const unsubscribe = expandedItemUIStore.currentItem.onChange(({ value }) => {
      if (value) {
        setIsExpandedItemOpen(true);
        // Open the sheet
        expandedItemSheetRef.current?.snapToIndex(0);
      } else {
        setIsExpandedItemOpen(false);
        expandedItemSheetRef.current?.close();
      }
    });
    // Initialize if a value exists
    const initialItem = expandedItemUIStore.currentItem.get();
    if (initialItem) {
      setIsExpandedItemOpen(true);
      setTimeout(() => expandedItemSheetRef.current?.snapToIndex(0), 0);
    }
    return unsubscribe;
  }, []);

  const handleSettingsPress = useCallback(() => {
    console.log('⚙️ [TabLayout] handleSettingsPress called');
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
  }, [isSettingsOpen, isAddSheetOpen]);

  const handleFilterPress = () => {
    console.log('🔍 [TabLayout] handleFilterPress called');
    if (isFilterSheetOpen) {
      filterSheetRef.current?.close();
      setIsFilterSheetOpen(false);
    } else {
      // Close settings if open before opening filter
      if (isSettingsOpen) {
        settingsSheetRef.current?.close();
        setIsSettingsOpen(false);
      }
      filterSheetRef.current?.expand();
      setIsFilterSheetOpen(true);
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
      const timestamp = new Date().toISOString();
      console.log('🔄 [TabLayout] Pan gesture START at:', timestamp);
      console.log('🔄 [TabLayout] Current view:', currentView);
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // Calculate new position with boundaries
      const newX = startX.value + event.translationX;
      // Clamp between -SCREEN_WIDTH (spaces) and 0 (everything)
      translateX.value = Math.max(-SCREEN_WIDTH, Math.min(0, newX));
    })
    .onEnd((event) => {
      const timestamp = new Date().toISOString();
      const velocity = event.velocityX;
      const position = translateX.value;

      console.log('🔄 [TabLayout] Pan gesture END at:', timestamp);
      console.log('🔄 [TabLayout] Velocity:', velocity, 'Position:', position);

      // Determine which view to snap to based on velocity and position
      let targetView: 'everything' | 'spaces';

      // If velocity is strong enough, use velocity to determine direction
      if (Math.abs(velocity) > 500) {
        targetView = velocity > 0 ? 'everything' : 'spaces';
      } else {
        // Otherwise use position (snap to nearest)
        targetView = position > -SCREEN_WIDTH / 2 ? 'everything' : 'spaces';
      }

      console.log('🔄 [TabLayout] Target view:', targetView);

      // Animate to target position
      const targetX = targetView === 'everything' ? 0 : -SCREEN_WIDTH;
      translateX.value = withTiming(targetX, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });

      // Update the view state
      if (targetView !== currentView) {
        console.log('🔄 [TabLayout] Changing view from', currentView, 'to', targetView);
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

      {/* Bottom Navigation */}
      <BottomNavigation
        currentView={currentView}
        onViewChange={handleViewChange}
        onSettingsPress={handleFilterPress}
        onAddPress={handleAddPress}
        visible={!isExpandedItemOpen}
      />

      {/* Bottom Sheets - Higher z-index to appear above expanded views */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500, pointerEvents: 'box-none' }}>
        {/* Expanded Item Overlay - placed under Settings/Add sheets so they can still cover it if needed */}
        <ExpandedItemView
          ref={expandedItemSheetRef}
          item={expandedItemUIStore.currentItem.get()}
          onOpen={() => setIsExpandedItemOpen(true)}
          onClose={() => {
            expandedItemUIActions.closeExpandedItem();
            setIsExpandedItemOpen(false);
          }}
          onChat={(item) => {
            chatUIActions.openChat(item);
          }}
          onEdit={(item) => console.log('Edit item:', item.title)}
          onArchive={(item) => console.log('Archive item:', item.title)}
          onDelete={async (item) => {
            console.log('Delete item:', item.title);
            await itemsActions.removeItemWithSync(item.id);
            expandedItemUIActions.closeExpandedItem();
          }}
          onShare={async (item) => {
            if (item.url) {
              try {
                await Share.share({
                  url: item.url,
                  message: item.title,
                });
              } catch (error) {
                console.error('Error sharing:', error);
              }
            } else {
              Alert.alert('No URL', 'This item doesn\'t have a URL to share');
            }
          }}
          onSpaceChange={(item, spaceId) => console.log('Move item to space:', spaceId)}
          currentSpaceId={null}
        />
        <SettingsSheet
          ref={settingsSheetRef}
          onOpen={() => setIsSettingsOpen(true)}
          onClose={() => setIsSettingsOpen(false)}
        />
        <FilterSheet
          ref={filterSheetRef}
          onOpen={() => setIsFilterSheetOpen(true)}
          onClose={() => setIsFilterSheetOpen(false)}
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

        {/* Chat Sheet Modal - absolute container with higher z-index so it sits above everything */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, pointerEvents: 'box-none' }}>
          <ChatSheet ref={chatSheetRef} />
        </View>
      </View>
    </BottomSheetModalProvider>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    zIndex: 0,
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
});

export default TabLayout;