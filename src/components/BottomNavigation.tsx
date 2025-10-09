import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Host, ZStack, Image, ContextMenu, Button, Submenu, Switch } from '@expo/ui/swift-ui';
import { frame, glassEffect, onTapGesture } from '@expo/ui/swift-ui/modifiers';
import { themeStore } from '../stores/theme';
import { filterStore, filterActions } from '../stores/filter';
import { COLORS, CONTENT_TYPES } from '../constants';
import { ContentType } from '../types';

interface BottomNavigationProps {
  currentView: 'everything' | 'spaces';
  onViewChange: (view: 'everything' | 'spaces') => void;
  onSettingsPress: () => void;
  onAddPress: () => void;
  visible?: boolean;
}

const BottomNavigation = observer(({
  currentView,
  onViewChange,
  onSettingsPress,
  onAddPress,
  visible = true,
}: BottomNavigationProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const sortOrder = filterStore.sortOrder.get();
  const selectedContentType = filterStore.selectedContentType.get();
  const selectedTags = filterStore.selectedTags.get();

  // Placeholder tags
  const placeholderTags = ['Important', 'Work', 'Personal', 'Learning', 'To Review'];

  // if (!visible) return null;

  return (
    <>
      {/* Liquid Glass Action Buttons */}
      {/* Filter Menu Button - Bottom Left */}
      <View
        style={[
          styles.glassButtonHost,
          styles.leftButton,
          { bottom: insets.bottom - 20 }
        ]}
      >
        <Host style={{ width: 60, height: 60 }}>
          <ContextMenu>
            <ContextMenu.Trigger>
              <ZStack
                modifiers={[
                  frame({ width: 60, height: 60 }),
                  glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' })
                ]}
              >
                <Image
                  systemName="line.3.horizontal.decrease"
                  size={24}
                  color={isDarkMode ? 'white' : 'black'}
                />
              </ZStack>
            </ContextMenu.Trigger>

            <ContextMenu.Items>
              {/* Reset All Filters */}
              <Button onPress={() => filterActions.clearAll()}>
                Reset
              </Button>

              {/* Sort Section */}
              <Button onPress={() => filterActions.setSortOrder('recent')}>
                {sortOrder === 'recent' ? '✓ Recently Added' : 'Recently Added'}
              </Button>
              <Button onPress={() => filterActions.setSortOrder('oldest')}>
                {sortOrder === 'oldest' ? '✓ Oldest First' : 'Oldest First'}
              </Button>

              {/* Type Submenu - Single selection with Buttons */}
              <Submenu button={<Button>Type</Button>}>
                {(Object.keys(CONTENT_TYPES) as ContentType[]).map((contentType) => {
                  const isSelected = selectedContentType === contentType;
                  const config = CONTENT_TYPES[contentType];
                  return (
                    <Button
                      key={contentType}
                      onPress={() => filterActions.selectContentType(contentType)}
                    >
                      {isSelected ? `✓ ${config.label}` : config.label}
                    </Button>
                  );
                })}
                {selectedContentType !== null && (
                  <Button onPress={() => filterActions.clearContentType()}>
                    Clear
                  </Button>
                )}
              </Submenu>

              {/* Tags Submenu - Multi-selection with Switches to keep menu open */}
              <Submenu button={<Button>Tags</Button>}>
                {placeholderTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <Switch
                      key={tag}
                      variant="checkbox"
                      label={tag}
                      value={isSelected}
                      onValueChange={() => filterActions.toggleTag(tag)}
                    />
                  );
                })}
                {selectedTags.length > 0 && (
                  <Button onPress={() => filterActions.clearTags()}>
                    Clear All
                  </Button>
                )}
              </Submenu>
            </ContextMenu.Items>
          </ContextMenu>
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
          name="spaces"
          onPress={() => {
            const timestamp = new Date().toISOString();
            console.log('📱 [BottomNav] Spaces tab pressed at:', timestamp);
            onViewChange('spaces');
          }}
          onTouchStart={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Spaces tab TOUCH START at:', timestamp);
            console.log('👆 [BottomNav] Touch coords:', e.nativeEvent.pageX, e.nativeEvent.pageY);
          }}
          onTouchEnd={(e) => {
            const timestamp = new Date().toISOString();
            console.log('👆 [BottomNav] Spaces tab TOUCH END at:', timestamp);
          }}
        >
          <Icon src={<VectorIcon family={MaterialIcons} name="folder" />} selectedColor={COLORS.warning} />
          <Label selectedStyle={{ color: COLORS.warning }}>Spaces</Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {/* Add Item Button - Bottom Right */}
      <View
        style={[
          styles.glassButtonHost,
          styles.rightButton,
          { bottom: insets.bottom - 20 }
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
              color={isDarkMode ? 'white' : 'black'}
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
