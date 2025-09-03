import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { observer } from '@legendapp/state/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { themeStore } from '../../src/stores/theme';
import BottomNavigation from '../../src/components/BottomNavigation';
import SettingsSheet from '../../src/components/SettingsSheet';
import AddItemSheet from '../../src/components/AddItemSheet';
import HomeScreen from './index';
import SpacesScreen from './spaces';

const TabLayout = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [currentView, setCurrentView] = useState<'everything' | 'spaces'>('everything');
  
  // Bottom sheet refs
  const settingsSheetRef = useRef<BottomSheet>(null);
  const addItemSheetRef = useRef<BottomSheet>(null);

  const handleSettingsPress = () => {
    settingsSheetRef.current?.expand();
  };

  const handleAddPress = () => {
    addItemSheetRef.current?.expand();
  };

  const handleViewChange = (view: 'everything' | 'spaces') => {
    setCurrentView(view);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        {/* Main Content */}
        <View style={styles.content}>
          {currentView === 'everything' ? <HomeScreen /> : <SpacesScreen />}
        </View>

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
      </View>
    </GestureHandlerRootView>
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
  content: {
    flex: 1,
  },
});

export default TabLayout;