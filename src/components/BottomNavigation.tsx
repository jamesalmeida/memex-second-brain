import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../stores/theme';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface BottomNavigationProps {
  currentView: 'everything' | 'spaces';
  onViewChange: (view: 'everything' | 'spaces') => void;
  onSettingsPress: () => void;
  onAddPress: () => void;
}

const BottomNavigation = observer(({
  currentView,
  onViewChange,
  onSettingsPress,
  onAddPress,
}: BottomNavigationProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <BlurView 
        intensity={80} 
        tint={isDarkMode ? 'dark' : 'light'}
        style={[styles.blurContainer, { paddingBottom: insets.bottom }]}
      >
        <View style={styles.navigationContent}>
          {/* Settings Button */}
          <TouchableOpacity
            style={[styles.circleButton, isDarkMode && styles.circleButtonDark]}
            onPress={onSettingsPress}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name="menu" 
              size={24} 
              color={isDarkMode ? '#FFFFFF' : '#333333'} 
            />
          </TouchableOpacity>

          {/* View Toggle Pill */}
          <View style={[styles.pillContainer, isDarkMode && styles.pillContainerDark]}>
            <TouchableOpacity
              style={[
                styles.pillButton,
                currentView === 'everything' && styles.pillButtonActive,
              ]}
              onPress={() => onViewChange('everything')}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="apps"
                size={20}
                color={currentView === 'everything' ? '#FFFFFF' : (isDarkMode ? '#888' : '#666')}
              />
            </TouchableOpacity>
            
            <View style={[styles.pillDivider, isDarkMode && styles.pillDividerDark]} />
            
            <TouchableOpacity
              style={[
                styles.pillButton,
                currentView === 'spaces' && styles.pillButtonActive,
              ]}
              onPress={() => onViewChange('spaces')}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="folder"
                size={20}
                color={currentView === 'spaces' ? '#FFFFFF' : (isDarkMode ? '#888' : '#666')}
              />
            </TouchableOpacity>
          </View>

          {/* Add Button */}
          <TouchableOpacity
            style={[styles.circleButton, styles.addButton]}
            onPress={onAddPress}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name="add" 
              size={28} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blurContainer: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 60,
  },
  circleButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  circleButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addButton: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    height: 46,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
  },
  pillButtonActive: {
    backgroundColor: '#FF6B35',
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillDividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default BottomNavigation;