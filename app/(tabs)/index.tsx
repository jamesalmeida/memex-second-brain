import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, Dimensions, ScrollView, PanResponder } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
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
import HeaderBar, { HeaderTabConfig } from '../../src/components/HeaderBar';
import { useDrawer } from '../../src/contexts/DrawerContext';
import { DrawerContentBody } from '../../src/components/DrawerContent';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding
const EDGE_SWIPE_WIDTH_EVERYTHING = 30; // Narrower drawer swipe area on Everything tab to avoid intercepting taps

interface HomeScreenProps {
  onExpandedItemOpen?: () => void;
  onExpandedItemClose?: () => void;
}

const HomeScreen = observer(({ onExpandedItemOpen, onExpandedItemClose }: HomeScreenProps = {}) => {
  // Get drawer from context directly instead of via props
  const { registerNavigateToSpaceHandler, registerNavigateToEverythingHandler } = useDrawer();

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
  const [selectedPage, setSelectedPage] = useState(1); // 0 = Drawer, 1 = Everything, 2..n = spaces
  const pagerRef = useRef<ScrollView>(null);
  const [isPagerScrollEnabled, setIsPagerScrollEnabled] = useState(true);

  // Shared value for scroll position to animate header underline
  const scrollOffsetX = useSharedValue(screenWidth); // Start at page 1 (Everything)

  const tabs: HeaderTabConfig[] = useMemo(() => [
    { key: 'drawer', icon: 'hamburger' },
    { key: 'everything', label: 'Everything' },
    ...spaces.map(space => ({
      key: `space-${space.id}`,
      label: space.name,
    })),
  ], [spaces]);

  const getItemsForSpace = useCallback((spaceId: string) => {
    const ids = itemSpacesComputed.getItemIdsInSpace(spaceId);
    return displayItems.filter(item => ids.includes(item.id));
  }, [displayItems]);

  const scrollToPage = useCallback((index: number, animated = true) => {
    setSelectedPage(index);
    pagerRef.current?.scrollTo({ x: index * screenWidth, animated });
    if (index <= 1) {
      spacesActions.setSelectedSpace(null);
    } else {
      const space = spaces[index - 2];
      if (space) spacesActions.setSelectedSpace(space);
    }
  }, [spaces]);

  const drawerPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, gestureState) => {
      const { dx, dy } = gestureState;
      return Math.abs(dx) > Math.abs(dy) && dx < -10;
    },
    onPanResponderRelease: (_evt, gestureState) => {
      if (gestureState.dx < -40 || gestureState.vx < -0.2) {
        scrollToPage(1);
      }
    },
    onPanResponderTerminate: (_evt, gestureState) => {
      if (gestureState.dx < -40 || gestureState.vx < -0.2) {
        scrollToPage(1);
      }
    },
  }), [scrollToPage]);

  useEffect(() => {
    const id = setTimeout(() => {
      pagerRef.current?.scrollTo({ x: screenWidth, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Handler for navigating to a specific space by ID
  const handleNavigateToSpace = useCallback((spaceId: string) => {
    const spaceIndex = spaces.findIndex(s => s.id === spaceId);
    if (spaceIndex !== -1) {
      // +2 because index 0 is Drawer, 1 is Everything
      scrollToPage(spaceIndex + 2);
    }
  }, [spaces, scrollToPage]);

  // Register the navigate to space handler
  useEffect(() => {
    registerNavigateToSpaceHandler(handleNavigateToSpace);
  }, [registerNavigateToSpaceHandler, handleNavigateToSpace]);

  // Register the navigate to EVERYTHING handler
  useEffect(() => {
    const handleNavigateToEverything = () => {
      scrollToPage(1);
    };
    registerNavigateToEverythingHandler(handleNavigateToEverything);
  }, [registerNavigateToEverythingHandler, scrollToPage]);

  const handlePageChange = useCallback((e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (page !== selectedPage) {
      setSelectedPage(page);
      if (page <= 1) {
        spacesActions.setSelectedSpace(null);
      } else {
        const space = spaces[page - 2];
        if (space) spacesActions.setSelectedSpace(space);
      }
    }
  }, [selectedPage, spaces]);

  const handleScroll = useCallback((e: any) => {
    scrollOffsetX.value = e.nativeEvent.contentOffset.x;
  }, [scrollOffsetX]);

  const handleHamburgerPress = useCallback((previousIndex: number) => {
    scrollToPage(previousIndex);
  }, [scrollToPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Refresh from backend
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

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
        scrollOffset={scrollOffsetX}
        onHamburgerPress={handleHamburgerPress}
      />

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handlePageChange}
        scrollEnabled={isPagerScrollEnabled && !shouldDisableScroll}
        onTouchStart={(e) => {
          // On the Everything tab, give drawer edge swipe precedence over pager
          if (selectedPage === 1) {
            const touchX = e.nativeEvent.pageX ?? 0;
            // Use wider swipe area for Everything tab (150px)
            if (touchX <= EDGE_SWIPE_WIDTH_EVERYTHING) {
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
        {/* Page 0: Drawer */}
        <View
          style={{ width: screenWidth, height: '100%', paddingTop: 10 }}
          {...drawerPanResponder.panHandlers}
        >
          <DrawerContentBody />
        </View>

        {/* Page 1: Everything */}
        <View style={{ width: screenWidth }}>
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
        </View>

        {/* Pages 2..n: one per space */}
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
  listContent: {
    marginTop: 10,
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
});
