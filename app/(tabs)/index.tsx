import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, Dimensions, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS, interpolate, Extrapolate } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { themeStore } from '../../src/stores/theme';
import { itemsStore, itemsActions } from '../../src/stores/items';
import { expandedItemUIActions } from '../../src/stores/expandedItemUI';
import { filterStore, filterActions } from '../../src/stores/filter';
import ItemCard from '../../src/components/items/ItemCard';
// Expanded item view is now rendered at the tab layout level overlay
import { Item } from '../../src/types';
import { generateMockItems, getEmptyStateMessage } from '../../src/utils/mockData';
import { useRadialMenu } from '../../src/contexts/RadialMenuContext';
import { spacesComputed, spacesActions } from '../../src/stores/spaces';
import { itemSpacesComputed } from '../../src/stores/itemSpaces';
import HeaderBar from '../../src/components/HeaderBar';
import { useDrawer } from '../../src/contexts/DrawerContext';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding
const EDGE_SWIPE_WIDTH = 50; // Match drawer swipeEdgeWidth so drawer wins near the left edge
const DRAG_THRESHOLD = 90; // Distance in px to trigger drawer open

interface AnimatedChevronIndicatorProps {
  dragX: Animated.SharedValue<number>;
  isDarkMode: boolean;
  isVisible: boolean;
  topOffset: number; // Account for HeaderBar height
}

const AnimatedChevronIndicator = ({ dragX, isDarkMode, isVisible, topOffset }: AnimatedChevronIndicatorProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    // Calculate opacity: fade in from 0.3 to 1.0 based on drag progress
    const opacity = interpolate(
      dragX.value,
      [0, DRAG_THRESHOLD],
      [0.3, 1.0],
      Extrapolate.CLAMP
    );

    // Calculate scale: grow from 1.0 to 1.4 as threshold approaches
    const scale = interpolate(
      dragX.value,
      [0, DRAG_THRESHOLD * 0.8, DRAG_THRESHOLD],
      [1.0, 1.2, 1.4],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.chevronIndicator,
        {
          top: topOffset + 100, // Below header, centered vertically
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.chevronText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
        ››
      </Text>
    </Animated.View>
  );
};

interface HomeScreenProps {
  onExpandedItemOpen?: () => void;
  onExpandedItemClose?: () => void;
}

const HomeScreen = observer(({ onExpandedItemOpen, onExpandedItemClose }: HomeScreenProps = {}) => {
  // Get drawer from context directly instead of via props
  const { openDrawer } = useDrawer();
  console.log('🏠 [HomeScreen] Component rendered, openDrawer from context:', typeof openDrawer);

  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const showMockData = themeStore.showMockData.get();
  const allItems = itemsStore.items.get();
  const sortOrder = filterStore.sortOrder.get();
  const selectedContentType = filterStore.selectedContentType.get();
  const selectedTags = filterStore.selectedTags.get();
  const [refreshing, setRefreshing] = useState(false);
  // Expanded item is controlled at the TabLayout overlay via expandedItemUI store
  const listRef = useRef<FlashList<Item>>(null);
  const previousItemCount = useRef(allItems.length);

  // Get radial menu state to disable scroll when menu is active
  const { shouldDisableScroll } = useRadialMenu();

  // Pull-to-open-drawer gesture state (using Reanimated for native performance)
  const dragX = useSharedValue(0);
  const [isGesturing, setIsGesturing] = useState(false);
  const hasHapticsTriggeredAt50 = useRef(false);

  // Initialize items and filters on first load
  useEffect(() => {
    const initializeItems = async () => {
      // Load items from storage first
      await itemsActions.loadItems();

      // If no items exist after loading, generate mock items
      if (itemsStore.items.get().length === 0) {
        const mockItems = generateMockItems(20);
        await itemsActions.setItems(mockItems);
      }
    };

    const initializeFilters = async () => {
      await filterActions.load();
    };

    initializeItems();
    initializeFilters();
  }, []);

  // Expanded item is orchestrated by TabLayout; no local subscription needed here

  // Auto-scroll to top when new items are added
  useEffect(() => {
    const currentItemCount = allItems.length;

    // Check if items were added (not removed or initial load)
    if (currentItemCount > previousItemCount.current && previousItemCount.current > 0) {
      // Scroll to top to show the new item, accounting for the content padding
      listRef.current?.scrollToOffset({ offset: -insets.top, animated: true });
    }

    // Update previous count
    previousItemCount.current = currentItemCount;
  }, [allItems.length, insets.top]);

  // Filter items based on showMockData toggle, filters, and sort order
  const displayItems = useMemo(() => {
    let filtered;
    if (showMockData) {
      filtered = allItems; // Show all items including mock
    } else {
      filtered = allItems.filter(item => !item.isMockData); // Only show real items
    }

    // Apply content type filter (single selection)
    if (selectedContentType !== null) {
      filtered = filtered.filter(item => item.content_type === selectedContentType);
    }

    // Apply tag filter (multiple selection)
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item => {
        // Check if item has any of the selected tags
        return item.tags?.some(tag => selectedTags.includes(tag)) ?? false;
      });
    }

    // Sort by created_at based on sortOrder
    return filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      if (sortOrder === 'recent') {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });
  }, [allItems, showMockData, selectedContentType, selectedTags, sortOrder]);

  // Spaces and pager state
  const spaces = spacesComputed.spaces();
  const [selectedPage, setSelectedPage] = useState(0); // 0 = Everything, 1..n = spaces
  const pagerRef = useRef<ScrollView>(null);
  const [isPagerScrollEnabled, setIsPagerScrollEnabled] = useState(true);

  const tabs = useMemo(() => [
    'Everything',
    ...spaces.map(s => s.name)
  ], [spaces]);

  const getItemsForSpace = useCallback((spaceId: string) => {
    const ids = itemSpacesComputed.getItemIdsInSpace(spaceId);
    return displayItems.filter(item => ids.includes(item.id));
  }, [displayItems]);

  const scrollToPage = useCallback((index: number) => {
    setSelectedPage(index);
    pagerRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    if (index === 0) {
      spacesActions.setSelectedSpace(null);
    } else {
      const space = spaces[index - 1];
      if (space) spacesActions.setSelectedSpace(space);
    }
  }, [spaces]);

  const handlePageChange = useCallback((e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (page !== selectedPage) {
      setSelectedPage(page);
      if (page === 0) {
        spacesActions.setSelectedSpace(null);
      } else {
        const space = spaces[page - 1];
        if (space) spacesActions.setSelectedSpace(space);
      }
    }
  }, [selectedPage, spaces]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Refresh from backend
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  // Haptic feedback helpers (called from gesture handlers)
  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerMediumHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const triggerHeavyHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  // Pull-to-open-drawer gesture handlers
  const onGestureEvent = useCallback(
    (event: any) => {
      'worklet';
      const x = event.nativeEvent.translationX;

      // Only respond to rightward drags (positive X)
      if (x > 0) {
        dragX.value = x;

        // Trigger medium haptic at 50% threshold (once per gesture)
        if (x >= DRAG_THRESHOLD * 0.5 && !hasHapticsTriggeredAt50.current) {
          hasHapticsTriggeredAt50.current = true;
          runOnJS(triggerMediumHaptic)();
        }
      } else {
        dragX.value = 0;
      }
    },
    [dragX, triggerMediumHaptic]
  );

  const onHandlerStateChange = useCallback(
    (event: any) => {
      'worklet';
      const { state, translationX } = event.nativeEvent;

      if (state === State.BEGAN) {
        // Only activate if dragging right (positive translationX)
        if (translationX >= 0) {
          runOnJS(setIsGesturing)(true);
          hasHapticsTriggeredAt50.current = false;
          runOnJS(triggerLightHaptic)();
        }
      } else if (state === State.END || state === State.CANCELLED) {
        if (translationX >= DRAG_THRESHOLD) {
          // Threshold reached - open drawer with heavy haptic
          runOnJS(triggerHeavyHaptic)();
          runOnJS(openDrawer)();
        }
        // Reset gesture state
        runOnJS(setIsGesturing)(false);
        hasHapticsTriggeredAt50.current = false;
        dragX.value = withTiming(0, {
          duration: 250,
        });
      }
    },
    [dragX, openDrawer, triggerLightHaptic, triggerHeavyHaptic]
  );

  // Animated style for grid translateX (runs on native thread for 60fps)
  const gridAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateX: dragX.value }],
    };
  });

  const handleItemPress = (item: Item) => {
    console.log('📱 [HomeScreen] handleItemPress called with item:', item.title);
    onExpandedItemOpen?.(); // Hint TabLayout to hide nav immediately
    expandedItemUIActions.expandItem(item); // Open expanded item via global store
  };

  const handleItemLongPress = (item: Item) => {
    // TODO: Show quick actions menu
    console.log('Item long pressed:', item.title);
  };

  const renderItem = ({ item }: { item: Item }) => (
    <View style={{ width: '100%', paddingHorizontal: 4, paddingBottom: 8 }}>
      <ItemCard
        item={item}
        onPress={handleItemPress}
        onLongPress={handleItemLongPress}
      />
    </View>
  );

  const EmptyState = () => {
    const emptyMessage = getEmptyStateMessage('home');
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, isDarkMode && styles.emptyTitleDark]}>
          {emptyMessage.title}
        </Text>
        <Text style={[styles.emptySubtitle, isDarkMode && styles.emptySubtitleDark]}>
          {emptyMessage.subtitle}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <HeaderBar
        tabs={tabs}
        selectedIndex={selectedPage}
        onTabPress={scrollToPage}
        onMenuPress={openDrawer}
      />

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handlePageChange}
        scrollEnabled={isPagerScrollEnabled && !shouldDisableScroll}
        onTouchStart={(e) => {
          // On the Everything tab, give drawer edge swipe precedence over pager
          if (selectedPage === 0) {
            const touchX = e.nativeEvent.pageX ?? 0;
            if (touchX <= EDGE_SWIPE_WIDTH) {
              setIsPagerScrollEnabled(false);
            } else if (!isPagerScrollEnabled) {
              setIsPagerScrollEnabled(true);
            }
          }
        }}
        onTouchEnd={() => {
          if (!isPagerScrollEnabled) setIsPagerScrollEnabled(true);
        }}
        onTouchCancel={() => {
          if (!isPagerScrollEnabled) setIsPagerScrollEnabled(true);
        }}
      >
        {/* Page 0: Everything */}
        <View style={{ width: screenWidth }}>
          <PanGestureHandler
            enabled={selectedPage === 0 && !shouldDisableScroll}
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            activeOffsetX={5} // Require 5px horizontal movement to activate
            failOffsetX={-5} // Fail if moving left
          >
            <Animated.View style={[{ flex: 1 }, gridAnimatedStyle]}>
              <FlashList
                ref={listRef}
                data={displayItems}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                masonry
                numColumns={2}
                estimatedItemSize={200}
                contentContainerStyle={[styles.listContent, { paddingHorizontal: isDarkMode ? -4 : 4 }]}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!shouldDisableScroll}
                ListEmptyComponent={EmptyState}
                contentInsetAdjustmentBehavior="automatic"
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
                  />
                }
              />
            </Animated.View>
          </PanGestureHandler>

          {/* Chevron indicator for pull-to-open gesture */}
          <AnimatedChevronIndicator
            dragX={dragX}
            isDarkMode={isDarkMode}
            isVisible={isGesturing && selectedPage === 0}
            topOffset={insets.top}
          />
        </View>

        {/* Pages 1..n: one per space */}
        {spaces.map(space => (
          <View key={space.id} style={{ width: screenWidth }}>
            <FlashList
              data={getItemsForSpace(space.id)}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              masonry
              numColumns={2}
              estimatedItemSize={200}
              contentContainerStyle={[styles.listContent, { paddingHorizontal: isDarkMode ? -4 : 4 }]}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!shouldDisableScroll}
              ListEmptyComponent={EmptyState}
              contentInsetAdjustmentBehavior="automatic"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
                />
              }
            />
          </View>
        ))}
      </ScrollView>

      {/* Expanded Item View moved to TabLayout overlay */}
    </View>
  );
});

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    zIndex: 1,
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 80, // Account for nav bar height
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyTitleDark: {
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptySubtitleDark: {
    color: '#999',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  chevronIndicator: {
    position: 'absolute',
    left: 20,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  chevronText: {
    fontSize: 36,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});