import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from '@legendapp/state/react';
import { BlurView } from 'expo-blur';
import BottomSheet from '@gorhom/bottom-sheet';
import { themeStore } from '../../src/stores/theme';
import BottomNavigation from '../../src/components/BottomNavigation';
import SettingsSheet from '../../src/components/SettingsSheet';
import AddItemSheet from '../../src/components/AddItemSheet';
import CreateSpaceSheet from '../../src/components/CreateSpaceSheet';
import HomeScreen from './index';
import SpacesScreen from './spaces';

const TabLayout = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const [currentView, setCurrentView] = useState<'everything' | 'spaces'>('everything');
  
  // Bottom sheet refs
  const settingsSheetRef = useRef<BottomSheet>(null);
  const addItemSheetRef = useRef<BottomSheet>(null);
  const createSpaceSheetRef = useRef<BottomSheet>(null);

  // Dismiss keyboard on mount
  useEffect(() => {
    Keyboard.dismiss();
  }, []);

  const handleSettingsPress = () => {
    settingsSheetRef.current?.expand();
  };

  const handleAddPress = () => {
    // Show different sheet based on current view
    if (currentView === 'spaces') {
      createSpaceSheetRef.current?.snapToIndex(0);
    } else {
      addItemSheetRef.current?.snapToIndex(0);
    }
  };

  const handleViewChange = (view: 'everything' | 'spaces') => {
    setCurrentView(view);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Main Content - extends full screen */}
      <View style={styles.fullScreenContent}>
        {currentView === 'everything' ? <HomeScreen /> : <SpacesScreen />}
      </View>

      {/* Blurred top safe area overlay - extends behind search bar */}
      <BlurView 
        intensity={80} 
        tint={isDarkMode ? 'dark' : 'light'}
        style={[
          styles.topSafeAreaOverlay, 
          { height: insets.top + 60 }
        ]}
      />

      {/* Custom Bottom Navigation */}
      <BottomNavigation
        currentView={currentView}
        onViewChange={handleViewChange}
        onSettingsPress={handleSettingsPress}
        onAddPress={handleAddPress}
      />

      {/* Bottom Sheets */}
      <SettingsSheet ref={settingsSheetRef} />
      <AddItemSheet ref={addItemSheetRef} />
      <CreateSpaceSheet ref={createSpaceSheetRef} />
    </View>
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
  },
  topSafeAreaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default TabLayout;