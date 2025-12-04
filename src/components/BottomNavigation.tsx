import React, { useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Host, ZStack, Image } from '@expo/ui/swift-ui';
import { frame, glassEffect, onTapGesture } from '@expo/ui/swift-ui/modifiers';
import { themeStore } from '../stores/theme';
import { COLORS } from '../constants';
import { useDrawer } from '../contexts/DrawerContext';

interface BottomNavigationProps {
  currentView: 'everything' | 'spaces';
  onViewChange: (view: 'everything' | 'spaces') => void;
  onAddPress: () => void;
  onAttachPress?: () => void;
  visible?: boolean;
}

const BottomNavigation = observer(({
  currentView,
  onViewChange,
  onAddPress,
  onAttachPress,
  visible = true,
}: BottomNavigationProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();

  // Use refs to ensure callbacks always have current values
  // SwiftUI's onTapGesture may cache the callback
  const currentViewRef = useRef(currentView);
  const onAddPressRef = useRef(onAddPress);
  const onAttachPressRef = useRef(onAttachPress);

  // Keep refs updated
  currentViewRef.current = currentView;
  onAddPressRef.current = onAddPress;
  onAttachPressRef.current = onAttachPress;

  // Stable callback that reads from refs
  const handleRightButtonPress = useCallback(() => {
    console.log('📎 [BottomNav] Right button pressed, currentView:', currentViewRef.current);
    if (currentViewRef.current === 'everything') {
      onAddPressRef.current();
    } else {
      onAttachPressRef.current?.();
    }
  }, []);

  // if (!visible) return null;

  const iconColor = isDarkMode ? '#FFFFFF' : '#000000';

  return (
    <>
      {/* Liquid Glass Action Buttons */}
      {/* Hamburger Menu Button - Bottom Left */}
      <View
        style={[
          styles.glassButtonHost,
          styles.leftButton,
          { bottom: insets.bottom - 20 },
        ]}
      >
        <Host style={{ width: 60, height: 60 }}>
          <ZStack
            modifiers={[
              frame({ width: 60, height: 60 }),
              glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
              onTapGesture(openDrawer)
            ]}
          >
            <Image
              systemName="line.3.horizontal"
              size={24}
              color={iconColor}
            />
          </ZStack>
        </Host>
      </View>

      {/* Native Tabs with Liquid Glass Effect */}
      <NativeTabs
        tintColor={COLORS.warning}
        blurEffect={isDarkMode ? "systemChromeMaterialDark" : "systemChromeMaterial"}
        backgroundColor={isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"}
      >
        <NativeTabs.Trigger
          name="index"
          onPress={() => {
            const timestamp = new Date().toISOString();
            console.log('📱 [BottomNav] Everything tab pressed at:', timestamp);
            onViewChange('everything');
          }}
          onTouchStart={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Everything tab TOUCH START at:', timestamp);
            console.log('👆 [BottomNav] Touch coords:', e.nativeEvent.pageX, e.nativeEvent.pageY);
          }}
          onTouchEnd={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Everything tab TOUCH END at:', timestamp);
          }}
        >
          <Icon src={<VectorIcon family={MaterialIcons} name="grid-view" />} selectedColor={COLORS.warning} />
          <Label selectedStyle={{ color: COLORS.warning }}>Everything</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="assistant"
          onPress={() => {
            const timestamp = new Date().toISOString();
            console.log('📱 [BottomNav] Chat tab pressed at:', timestamp);
            onViewChange('spaces');
          }}
          onTouchStart={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Chat tab TOUCH START at:', timestamp);
            console.log('👆 [BottomNav] Touch coords:', e.nativeEvent.pageX, e.nativeEvent.pageY);
          }}
          onTouchEnd={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Chat tab TOUCH END at:', timestamp);
          }}
        >
          <Icon src={<VectorIcon family={Ionicons} name="chatbubble-ellipses-outline" />} selectedColor={COLORS.warning} />
          <Label selectedStyle={{ color: COLORS.warning }}>Chat</Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {/* Context-Specific Action Button - Bottom Right */}
      {/* Everything tab: Add item (+), Chat tab: Attach (paperclip) */}
      <View
        style={[
          styles.glassButtonHost,
          styles.rightButton,
          { bottom: insets.bottom - 20 },
        ]}
      >
        <Host style={{ width: 60, height: 60 }}>
          <ZStack
            modifiers={[
              frame({ width: 60, height: 60 }),
              glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
              onTapGesture(handleRightButtonPress)
            ]}
          >
            <Image
              systemName={currentView === 'everything' ? 'plus' : 'paperclip'}
              size={24}
              color={iconColor}
            />
          </ZStack>
        </Host>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  glassButtonHost: {
    position: 'absolute',
    width: 56,
    height: 56,
    zIndex: 1
  },
  leftButton: {
    left: 30,
  },
  rightButton: {
    right: 30,
  },
});

export default BottomNavigation;
