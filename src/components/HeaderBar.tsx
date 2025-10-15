import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../stores/theme';

interface HeaderBarProps {
  tabs: string[];
  selectedIndex: number;
  onTabPress: (index: number) => void;
  onMenuPress?: () => void;
}

const HeaderBar = observer(({ tabs, selectedIndex, onTabPress, onMenuPress }: HeaderBarProps) => {
  console.log('📌 [HeaderBar] Component rendered, onMenuPress:', typeof onMenuPress, 'value:', onMenuPress);

  const insets = useSafeAreaInsets();
  const isDarkMode = themeStore.isDarkMode.get();
  const scrollRef = useRef<ScrollView>(null);
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  const underlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';
  const inactiveColor = isDarkMode ? '#AAAAAA' : '#666666';

  useEffect(() => {
    if (!scrollRef.current || tabLayouts.length === 0 || selectedIndex < 0) return;
    const layout = tabLayouts[selectedIndex];
    if (!layout) return;
    // Center the selected tab if possible
    const targetX = Math.max(layout.x - 40, 0);
    scrollRef.current.scrollTo({ x: targetX, animated: true });
  }, [selectedIndex, tabLayouts]);

  const handleLayout = (index: number, x: number, width: number) => {
    setTabLayouts(prev => {
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDarkMode && styles.containerDark]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        onPress={() => {
          console.log('📌 [HeaderBar] Hamburger button pressed');
          console.log('📌 [HeaderBar] onMenuPress exists?', !!onMenuPress);
          if (onMenuPress) {
            console.log('📌 [HeaderBar] Calling onMenuPress()');
            onMenuPress();
          } else {
            console.log('❌ [HeaderBar] onMenuPress is undefined!');
          }
        }}
        style={styles.menuButton}
        activeOpacity={0.7}
      >
        <View style={[styles.menuLine, { backgroundColor: textColor }]} />
        <View style={[styles.menuLineShort, { backgroundColor: textColor }]} />
      </TouchableOpacity>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.tabsScroll}
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
  menuButton: {
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  menuLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  menuLineShort: {
    width: 12,
    height: 2,
    borderRadius: 1,
    marginTop: 6,
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


