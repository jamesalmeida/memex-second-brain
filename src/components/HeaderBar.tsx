import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host, ZStack, Image, ContextMenu, Button, Submenu, Switch } from '@expo/ui/swift-ui';
import { frame, glassEffect, onTapGesture } from '@expo/ui/swift-ui/modifiers';
import { themeStore } from '../stores/theme';
import { filterStore, filterActions } from '../stores/filter';
import { COLORS, CONTENT_TYPES } from '../constants';
import { ContentType } from '../types';

interface HeaderBarProps {
  tabs: string[];
  selectedIndex: number;
  onTabPress: (index: number) => void;
}

const HeaderBar = observer(({ tabs, selectedIndex, onTabPress }: HeaderBarProps) => {
  const insets = useSafeAreaInsets();
  const isDarkMode = themeStore.isDarkMode.get();
  const scrollRef = useRef<ScrollView>(null);
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [filterAreaWidth, setFilterAreaWidth] = useState(0);

  const sortOrder = filterStore.sortOrder.get();
  const selectedContentType = filterStore.selectedContentType.get();
  const selectedTags = filterStore.selectedTags.get();

  // Placeholder tags
  const placeholderTags = ['Important', 'Work', 'Personal', 'Learning', 'To Review'];

  const underlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';
  const inactiveColor = isDarkMode ? '#AAAAAA' : '#666666';

  useEffect(() => {
    if (!scrollRef.current || tabLayouts.length === 0 || selectedIndex < 0) return;
    const layout = tabLayouts[selectedIndex];
    if (!layout) return;
    if (scrollViewWidth <= 0) return;

    // Visual center of the entire header bar projected into the ScrollView's coordinate space
    const centerWithinScroll = Math.max(scrollViewWidth / 2 - filterAreaWidth / 2, 0);
    const desiredX = layout.x + layout.width / 2 - centerWithinScroll;
    const maxScrollX = Math.max(contentWidth - scrollViewWidth, 0);
    const clampedX = Math.max(0, Math.min(desiredX, maxScrollX));
    scrollRef.current.scrollTo({ x: clampedX, animated: true });
  }, [selectedIndex, tabLayouts, scrollViewWidth, contentWidth, filterAreaWidth]);

  const handleLayout = (index: number, x: number, width: number) => {
    setTabLayouts(prev => {
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDarkMode && styles.containerDark]}>
      <View style={styles.filterButtonContainer} onLayout={e => setFilterAreaWidth(e.nativeEvent.layout.width)}>
        <Host style={{ width: 40, height: 40 }}>
          <ContextMenu>
            <ContextMenu.Trigger>
              <ZStack
                modifiers={[
                  frame({ width: 40, height: 40 }),
                  glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' })
                ]}
              >
                <Image
                  systemName="line.3.horizontal.decrease"
                  size={20}
                  color={'gray'}
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
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.tabsScroll}
        onLayout={e => setScrollViewWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
      >
        {tabs.map((label, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={`${label}-${index}`}
              activeOpacity={0.7}
              onPress={() => onTabPress(index)}
              onLayout={e => handleLayout(index, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
              style={styles.tabButton}
            >
              <Text style={[styles.tabText, { color: isSelected ? textColor : inactiveColor }]}>{label}</Text>
              {isSelected ? <View style={[styles.underline, { backgroundColor: underlineColor }]} /> : <View style={styles.underlinePlaceholder} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default HeaderBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  containerDark: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabsScroll: {
    flex: 1,
  },
  tabsContainer: {
    paddingLeft: 0,
    paddingRight: 12,
  },
  filterButtonContainer: {
    paddingLeft: 12,
    paddingRight: 5,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  underline: {
    marginTop: 2,
    height: 2,
    alignSelf: 'stretch',
    borderRadius: 1,
  },
  underlinePlaceholder: {
    marginTop: 8,
    height: 2,
    opacity: 0,
  },
});


