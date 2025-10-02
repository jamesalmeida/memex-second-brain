import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Keyboard, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from '@legendapp/state/react';
import BottomSheet, { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { themeStore } from '../../src/stores/theme';
import { chatUIStore } from '../../src/stores/chatUI';
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
  const [currentView, setCurrentView] = useState<'everything' | 'spaces'>('everything');
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isExpandedItemOpen, setIsExpandedItemOpen] = useState(false);
  
  // Animation value for sliding views
  const slideAnimation = useRef(new Animated.Value(0)).current;
  
  // Bottom sheet refs
  const settingsSheetRef = useRef<BottomSheet>(null);
  const addItemSheetRef = useRef<any>(null);
  const createSpaceSheetRef = useRef<BottomSheet>(null);
  const chatSheetRef = useRef<BottomSheet>(null);

  // Dismiss keyboard on mount
  useEffect(() => {
    Keyboard.dismiss();
  }, []);

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
    Animated.timing(slideAnimation, {
      toValue: view === 'everything' ? 0 : -SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setCurrentView(view);
  };

  return (
    <BottomSheetModalProvider>
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        {/* Main Content - extends full screen */}
        <View style={styles.fullScreenContent}>
        <Animated.View
          style={[
            styles.slidingContainer,
            {
              transform: [{ translateX: slideAnimation }]
            }
          ]}
        >
          {/* Everything View */}
          <View style={styles.viewContainer} pointerEvents={currentView === 'everything' ? 'auto' : 'none'}>
            <HomeScreen
              onExpandedItemOpen={() => setIsExpandedItemOpen(true)}
              onExpandedItemClose={() => setIsExpandedItemOpen(false)}
            />
          </View>
          
          {/* Spaces View */}
          <View style={styles.viewContainer} pointerEvents={currentView === 'spaces' ? 'auto' : 'none'}>
            <SpacesScreen onSpaceOpen={setCurrentSpaceId} onSpaceClose={() => setCurrentSpaceId(null)} />
          </View>
        </Animated.View>
      </View>

      {/* Custom Bottom Navigation */}
      <BottomNavigation
        currentView={currentView}
        onViewChange={handleViewChange}
        onSettingsPress={handleSettingsPress}
        onAddPress={handleAddPress}
        isSheetOpen={isAddSheetOpen}
        visible={!isExpandedItemOpen}
      />

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
});

export default TabLayout;