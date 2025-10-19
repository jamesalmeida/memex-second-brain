import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../stores/theme';

export interface HeaderTabConfig {
  key: string;
  label?: string;
  icon?: 'hamburger';
}

interface HeaderBarProps {
  tabs: HeaderTabConfig[];
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

  const underlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';
  const inactiveColor = isDarkMode ? '#AAAAAA' : '#666666';

  useEffect(() => {
    if (selectedIndex === 0) {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    if (!scrollRef.current || tabLayouts.length === 0 || selectedIndex < 0) return;
    const layout = tabLayouts[selectedIndex];
    if (!layout) return;
    if (scrollViewWidth <= 0) return;

    // Visual center of the entire header bar projected into the ScrollView's coordinate space
    const desiredX = layout.x + layout.width / 2 - scrollViewWidth / 2;
    const maxScrollX = Math.max(contentWidth - scrollViewWidth, 0);
    const clampedX = Math.max(0, Math.min(desiredX, maxScrollX));
    scrollRef.current.scrollTo({ x: clampedX, animated: true });
  }, [selectedIndex, tabLayouts, scrollViewWidth, contentWidth]);

  const handleLayout = (index: number, x: number, width: number) => {
    setTabLayouts(prev => {
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  };

  const renderTab = (tab: HeaderTabConfig, index: number, isSticky = false) => {
    const isSelected = index === selectedIndex;
    const displayColor = isSelected ? textColor : inactiveColor;

    return (
      <TouchableOpacity
        key={tab.key ?? `${index}`}
        activeOpacity={0.7}
        onPress={() => onTabPress(index)}
        onLayout={e => handleLayout(index, isSticky ? 0 : e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
        style={[styles.tabButton, isSticky && styles.stickyTabButton]}
      >
        <View style={styles.tabContent}>
          {tab.icon === 'hamburger' ? (
            <View style={styles.hamburgerIcon}>
              <View style={[styles.hamburgerLine, { backgroundColor: displayColor }]} />
              <View style={[styles.hamburgerLine, { backgroundColor: displayColor, marginTop: 4 }]} />
              <View style={[styles.hamburgerLine, { backgroundColor: displayColor, marginTop: 4 }]} />
            </View>
          ) : (
            <Text style={[styles.tabText, { color: displayColor }]}>{tab.label ?? ''}</Text>
          )}
        </View>
        {isSelected ? <View style={[styles.underline, { backgroundColor: underlineColor }]} /> : <View style={styles.underlinePlaceholder} />}
      </TouchableOpacity>
    );
  };

  const stickyTab = tabs[0];
  const scrollableTabs = tabs.slice(1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDarkMode && styles.containerDark]}>
      {stickyTab && (
        <View style={styles.stickyContainer}>
          {renderTab(stickyTab, 0, true)}
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.tabsScroll}
        onLayout={e => setScrollViewWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
      >
        {scrollableTabs.map((tab, idx) => renderTab(tab, idx + 1))}
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
  stickyContainer: {
    paddingLeft: 12,
    paddingRight: 4,
  },
  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stickyTabButton: {
    paddingRight: 6,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  hamburgerIcon: {
    width: 20,
    alignItems: 'center',
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
});
