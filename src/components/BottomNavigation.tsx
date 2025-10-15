import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Host, ZStack, Image } from '@expo/ui/swift-ui';
import { frame, glassEffect, onTapGesture } from '@expo/ui/swift-ui/modifiers';
import { themeStore } from '../stores/theme';
import { COLORS } from '../constants';

interface BottomNavigationProps {
  currentView: 'grid' | 'spaces';
  onViewChange: (view: 'grid' | 'spaces') => void;
  onSettingsPress: () => void;
  onAddPress: () => void;
  onMenuPress?: () => void;
  visible?: boolean;
}

const BottomNavigation = observer(({
  currentView,
  onViewChange,
  onSettingsPress,
  onAddPress,
  onMenuPress,
  visible = true,
}: BottomNavigationProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();

  // if (!visible) return null;

  const textColor = isDarkMode ? '#FFFFFF' : '#000000';

  return (
    <>
      {/* Liquid Glass Action Buttons */}
      {/* Hamburger Menu Button - Bottom Left */}
      <View
        style={[
          styles.glassButtonHost,
          styles.leftButton,
          { bottom: insets.bottom - 20 }
        ]}
      >
        <Host style={{ width: 60, height: 60 }}>
          <ZStack
            modifiers={[
              frame({ width: 60, height: 60 }),
              glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
              onTapGesture(() => {
                console.log('📌 [BottomNav] Hamburger button pressed');
                console.log('📌 [BottomNav] onMenuPress exists?', !!onMenuPress);
                if (onMenuPress) {
                  console.log('📌 [BottomNav] Calling onMenuPress()');
                  onMenuPress();
                } else {
                  console.log('❌ [BottomNav] onMenuPress is undefined!');
                }
              })
            ]}
          >
            {/* Hamburger icon using three lines */}
            <View style={styles.hamburgerContainer}>
              <View style={[styles.menuLine, { backgroundColor: textColor }]} />
              <View style={[styles.menuLine, { backgroundColor: textColor, marginTop: 5 }]} />
              <View style={[styles.menuLine, { backgroundColor: textColor, marginTop: 5 }]} />
            </View>
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
            console.log('📱 [BottomNav] Grid tab pressed at:', timestamp);
            onViewChange('grid');
          }}
          onTouchStart={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Grid tab TOUCH START at:', timestamp);
            console.log('👆 [BottomNav] Touch coords:', e.nativeEvent.pageX, e.nativeEvent.pageY);
          }}
          onTouchEnd={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Grid tab TOUCH END at:', timestamp);
          }}
        >
          <Icon src={<VectorIcon family={MaterialIcons} name="grid-view" />} selectedColor={COLORS.warning} />
          <Label selectedStyle={{ color: COLORS.warning }}>Grid</Label>
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
              color={textColor}
              // color={isDarkMode ? 'white' : 'black'}
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
  hamburgerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: 60,
  },
  menuLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
});

export default BottomNavigation;
