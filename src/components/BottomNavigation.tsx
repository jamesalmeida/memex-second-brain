import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
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
  isSheetOpen?: boolean;
  visible?: boolean;
}

const BottomNavigation = observer(({
  currentView,
  onViewChange,
  onSettingsPress,
  onAddPress,
  isSheetOpen = false,
  visible = true,
}: BottomNavigationProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();

  // Animation value for the sliding indicator
  const slideAnimation = useRef(new Animated.Value(currentView === 'everything' ? 0 : 1)).current;

  // Animation value for the add button rotation
  const rotateAnimation = useRef(new Animated.Value(0)).current;

  // Animation value for hiding/showing the navigation
  const visibilityAnimation = useRef(new Animated.Value(visible ? 0 : 1)).current;
  
  // Animate the indicator when currentView changes
  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: currentView === 'everything' ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [currentView]);
  
  // Animate the add button rotation when sheet opens/closes
  useEffect(() => {
    Animated.timing(rotateAnimation, {
      toValue: isSheetOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isSheetOpen]);

  // Animate visibility when visible prop changes
  useEffect(() => {
    Animated.timing(visibilityAnimation, {
      toValue: visible ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);
  
  // Interpolate rotation value
  const rotateInterpolate = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'] // 45 degrees turns + into ×
  });

  // Interpolate translateY for visibility animation
  const translateY = visibilityAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150] // Slide down 150px to hide
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
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
            {/* Sliding indicator */}
            <Animated.View
              style={[
                styles.slidingIndicator,
                {
                  transform: [{
                    translateX: slideAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 52] // Further reduced for proper alignment
                    })
                  }]
                }
              ]}
            />
            
            <TouchableOpacity
              style={styles.pillButton}
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
              style={styles.pillButton}
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
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
              <MaterialIcons 
                name="add" 
                size={28} 
                color="#FFFFFF" 
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000, // Ensure navigation stays on top
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
    position: 'relative',
    overflow: 'hidden',
  },
  pillContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    zIndex: 2,
  },
  slidingIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    width: 60, // Smaller width to fit better
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    zIndex: 1,
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