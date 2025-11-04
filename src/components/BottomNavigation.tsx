import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Host, ZStack, Image } from '@expo/ui/swift-ui';
import { frame, glassEffect, onTapGesture } from '@expo/ui/swift-ui/modifiers';
import { themeStore } from '../stores/theme';
import { COLORS } from '../constants';
import { FilterContextMenuTrigger } from './FilterContextMenuTrigger';

interface BottomNavigationProps {
  currentView: 'everything' | 'spaces';
  onViewChange: (view: 'everything' | 'spaces') => void;
  onAddPress: () => void;
  visible?: boolean;
}

const BottomNavigation = observer(({
  currentView,
  onViewChange,
  onAddPress,
  visible = true,
}: BottomNavigationProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();

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
        <FilterContextMenuTrigger hostStyle={{ width: 60, height: 60 }}>
          <ZStack
            modifiers={[
              frame({ width: 60, height: 60 }),
              glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' })
            ]}
          >
            <Image
              systemName="line.3.horizontal.decrease"
              size={24}
              color={iconColor}
            />
          </ZStack>
        </FilterContextMenuTrigger>
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
          name="spaces"
          onPress={() => {
            const timestamp = new Date().toISOString();
            console.log('📱 [BottomNav] Chats tab pressed at:', timestamp);
            onViewChange('spaces');
          }}
          onTouchStart={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Chats tab TOUCH START at:', timestamp);
            console.log('👆 [BottomNav] Touch coords:', e.nativeEvent.pageX, e.nativeEvent.pageY);
          }}
          onTouchEnd={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Chats tab TOUCH END at:', timestamp);
          }}
        >
          {/* <Icon src={<VectorIcon family={MaterialIcons} name="cube-outline" />} selectedColor={COLORS.warning} /> */}
          <Icon src={<VectorIcon family={Ionicons} name="cube-outline" />} selectedColor={COLORS.warning} />
          <Label selectedStyle={{ color: COLORS.warning }}>Chats</Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {/* Add Item Button - Bottom Right */}
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
              onTapGesture(onAddPress)
            ]}
          >
            <Image
              systemName="plus"
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
