import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withTiming, interpolate, Extrapolate, SharedValue, useSharedValue } from 'react-native-reanimated';
import { themeStore } from '../stores/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface HeaderTabConfig {
  key: string;
  label?: string;
  icon?: 'hamburger';
}

interface HeaderBarProps {
  tabs: HeaderTabConfig[];
  selectedIndex: number;
  onTabPress: (index: number) => void;
  scrollOffset?: SharedValue<number>;
  onHamburgerPress?: (previousIndex: number) => void;
}

const HeaderBar = observer(({ tabs, selectedIndex, onTabPress, scrollOffset, onHamburgerPress }: HeaderBarProps) => {
  const insets = useSafeAreaInsets();
  const isDarkMode = themeStore.isDarkMode.get();
  const scrollRef = useRef<ScrollView>(null);
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [previousSelectedIndex, setPreviousSelectedIndex] = useState(1); // Track previous tab for hamburger X press
  const headerScrollX = useSharedValue(0); // Track HeaderBar ScrollView's scroll position

  const underlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';
  const inactiveColor = isDarkMode ? '#AAAAAA' : '#666666';

  // Track previous selected index (excluding drawer at index 0)
  useEffect(() => {
    if (selectedIndex > 0) {
      setPreviousSelectedIndex(selectedIndex);
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === 0) {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      headerScrollX.value = withTiming(0, { duration: 250 });
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
    headerScrollX.value = withTiming(clampedX, { duration: 250 });
  }, [selectedIndex, tabLayouts, scrollViewWidth, contentWidth]);

  const handleLayout = (index: number, x: number, width: number) => {
    setTabLayouts(prev => {
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  };

  // Animated styles for hamburger -> X transformation
  const hamburgerAnimatedStyle = useAnimatedStyle(() => {
    const isDrawerOpen = selectedIndex === 0 ? 1 : 0;
    return {
      opacity: withTiming(1 - isDrawerOpen, { duration: 200 }),
    };
  });

  const topLineAnimatedStyle = useAnimatedStyle(() => {
    const isDrawerOpen = selectedIndex === 0 ? 1 : 0;
    return {
      transform: [
        { translateY: withTiming(isDrawerOpen * 6, { duration: 200 }) },
        { rotate: withTiming(`${isDrawerOpen * 45}deg`, { duration: 200 }) },
      ],
    };
  });

  const bottomLineAnimatedStyle = useAnimatedStyle(() => {
    const isDrawerOpen = selectedIndex === 0 ? 1 : 0;
    return {
      transform: [
        { translateY: withTiming(isDrawerOpen * -6, { duration: 200 }) },
        { rotate: withTiming(`${isDrawerOpen * -45}deg`, { duration: 200 }) },
      ],
    };
  });

  const renderTab = (tab: HeaderTabConfig, index: number, isSticky = false) => {
    const isSelected = index === selectedIndex;
    const displayColor = isSelected ? textColor : inactiveColor;

    return (
      <TouchableOpacity
        key={tab.key ?? `${index}`}
        activeOpacity={0.7}
        onPress={() => {
          if (tab.icon === 'hamburger' && selectedIndex === 0) {
            // If drawer is open and X is pressed, go back to previous tab
            onHamburgerPress?.(previousSelectedIndex);
          } else {
            onTabPress(index);
          }
        }}
        onLayout={e => handleLayout(index, isSticky ? 0 : e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
        style={[styles.tabButton, isSticky && styles.stickyTabButton]}
      >
        <View style={styles.tabContent}>
          {tab.icon === 'hamburger' ? (
            <View style={styles.hamburgerIcon}>
              <Animated.View style={[styles.hamburgerLine, { backgroundColor: displayColor }, topLineAnimatedStyle]} />
              <Animated.View style={[styles.hamburgerLine, { backgroundColor: displayColor, marginTop: 4 }, hamburgerAnimatedStyle]} />
              <Animated.View style={[styles.hamburgerLine, { backgroundColor: displayColor, marginTop: 4 }, bottomLineAnimatedStyle]} />
            </View>
          ) : (
            <Text style={[styles.tabText, { color: displayColor }]}>{tab.label ?? ''}</Text>
          )}
        </View>
        {/* No individual underlines - using animated underline instead */}
        <View style={tab.icon === 'hamburger' ? styles.iconUnderlinePlaceholder : styles.underlinePlaceholder} />
      </TouchableOpacity>
    );
  };

  const stickyTab = tabs[0];
  const scrollableTabs = tabs.slice(1);

  // Animated underline that slides with scroll
  const animatedUnderlineStyle = useAnimatedStyle(() => {
    if (!scrollOffset || tabLayouts.length < 2) {
      return { opacity: 0 };
    }

    // Get scroll position
    const scrollX = scrollOffset.value;

    // Map scroll position to page index
    // Page 0 (drawer) = scrollX 0
    // Page 1 (everything) = scrollX SCREEN_WIDTH
    // Page 2 (first space) = scrollX 2*SCREEN_WIDTH, etc.
    const pageIndex = scrollX / SCREEN_WIDTH;

    // Skip underline when on drawer page (index 0)
    if (pageIndex < 0.5) {
      return { opacity: withTiming(0, { duration: 150 }) };
    }

    // Determine which two tabs we're between for interpolation
    const currentPageIndex = Math.floor(pageIndex);
    const nextPageIndex = Math.ceil(pageIndex);
    const progress = pageIndex - currentPageIndex;

    // Get tab layouts (page index 1 = tab index 1, page index 2 = tab index 2, etc.)
    const currentLayout = tabLayouts[currentPageIndex];
    const nextLayout = tabLayouts[nextPageIndex];

    if (!currentLayout) {
      return { opacity: 0 };
    }

    // If we're at the end or don't have a next layout, just use current
    if (!nextLayout || currentPageIndex === nextPageIndex) {
      const adjustedX = currentLayout.x - headerScrollX.value;
      return {
        opacity: 1,
        transform: [{ translateX: adjustedX }],
        width: currentLayout.width,
      };
    }

    // Interpolate position and width between current and next tab
    const x = interpolate(
      progress,
      [0, 1],
      [currentLayout.x, nextLayout.x],
      Extrapolate.CLAMP
    );

    const width = interpolate(
      progress,
      [0, 1],
      [currentLayout.width, nextLayout.width],
      Extrapolate.CLAMP
    );

    // Adjust for the HeaderBar's internal scroll position
    const adjustedX = x - headerScrollX.value;

    return {
      opacity: 1,
      transform: [{ translateX: adjustedX }],
      width,
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDarkMode && styles.containerDark]}>
      {stickyTab && (
        <View style={styles.stickyContainer}>
          {renderTab(stickyTab, 0, true)}
        </View>
      )}
      <View style={{ flex: 1, position: 'relative' }}>
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

        {/* Animated underline */}
        <Animated.View
          style={[
            styles.animatedUnderline,
            { backgroundColor: underlineColor },
            animatedUnderlineStyle,
          ]}
        />
      </View>
    </View>
  );
});

export default HeaderBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.9)',
    // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingBottom: 10,
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
    paddingHorizontal: 0,
    marginHorizontal: 10,
    paddingVertical: 0,
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
  underlinePlaceholder: {
    marginTop: 8,
    height: 2,
    opacity: 0,
  },
  iconUnderlinePlaceholder: {
    marginTop: 2,
    height: 0,
    opacity: 0,
  },
  animatedUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    borderRadius: 1,
  },
  hamburgerIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
});
