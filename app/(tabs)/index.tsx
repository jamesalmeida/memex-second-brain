import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { themeStore } from '../../src/stores/theme';
import { itemsStore, itemsActions } from '../../src/stores/items';
import { itemTypeMetadataStore } from '../../src/stores/itemTypeMetadata';
import { expandedItemUIActions } from '../../src/stores/expandedItemUI';
import { filterStore, filterActions, filterComputed } from '../../src/stores/filter';
import { syncStatusStore } from '../../src/stores/syncStatus';
import { pendingItemsStore } from '../../src/stores/pendingItems';
import { processingItemsComputed } from '../../src/stores/processingItems';
import ItemCard from '../../src/components/items/ItemCard';
import { Item } from '../../src/types';
import { getEmptyStateMessage } from '../../src/utils/mockData';
import { useRadialMenu } from '../../src/contexts/RadialMenuContext';
import { spacesComputed } from '../../src/stores/spaces';
import SimpleHeader from '../../src/components/SimpleHeader';
import FilterPills from '../../src/components/FilterPills';

const { width: screenWidth } = Dimensions.get('window');

interface HomeScreenProps {
  onExpandedItemOpen?: () => void;
  onExpandedItemClose?: () => void;
}

const HomeScreen = observer(({ onExpandedItemOpen, onExpandedItemClose }: HomeScreenProps = {}) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const allItems = itemsStore.items.get();
  const pendingItems = pendingItemsStore.items.get();
  const sortOrder = filterStore.sortOrder.get();
  const selectedContentType = filterStore.selectedContentType.get();
  const selectedTags = filterStore.selectedTags.get();
  const selectedSpaceId = filterStore.selectedSpaceId.get();
  const showArchived = filterStore.showArchived.get();
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlashList<Item>>(null);
  const previousItemCount = useRef(allItems.length);
  const isInitialMount = useRef(true);

  // Get radial menu state to disable scroll when menu is active
  const { shouldDisableScroll } = useRadialMenu();

  // Initialize items and filters on first load
  useEffect(() => {
    const initializeItems = async () => {
      // Load items from storage
      await itemsActions.loadItems();
    };

    const initializeFilters = async () => {
      await filterActions.load();
    };

    const initializePendingItems = async () => {
      // Load pending items from storage
      const { pendingItemsActions } = await import('../../src/stores/pendingItems');
      await pendingItemsActions.loadItems();
    };

    initializeItems();
    initializeFilters();
    initializePendingItems();
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

  // Scroll to top when filters change (but not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    listRef.current?.scrollToOffset({ offset: -insets.top, animated: true });
  }, [selectedContentType, selectedTags, sortOrder, selectedSpaceId, showArchived, insets.top]);

  // Filter items based on all filter criteria
  const displayItems = useMemo(() => {
    // First filter by archive status
    let filtered = showArchived
      ? allItems.filter(item => !item.is_deleted && item.is_archived)
      : allItems.filter(item => !item.is_deleted && !item.is_archived);

    // Apply space filter
    if (selectedSpaceId !== null) {
      filtered = filtered.filter(item => item.space_id === selectedSpaceId);
    }

    // Apply content type filter (single selection)
    if (selectedContentType !== null) {
      filtered = filtered.filter(item => {
        // Treat 'podcast' and 'podcast_episode' as equivalent
        if (selectedContentType === 'podcast') {
          return item.content_type === 'podcast' || item.content_type === 'podcast_episode';
        }
        return item.content_type === selectedContentType;
      });
    }

    // Apply tag filter (multiple selection - requires ALL selected tags)
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item => {
        // Check if item has all of the selected tags
        return selectedTags.every(selectedTag => item.tags?.includes(selectedTag));
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
  }, [allItems, pendingItems, selectedContentType, selectedTags, sortOrder, selectedSpaceId, showArchived]);

  // Track metadata changes to force FlashList re-renders when images are added/removed
  const metadataVersion = itemTypeMetadataStore.typeMetadata.get().length;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Refresh from backend
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleItemPress = (item: Item) => {
    console.log('📱 [HomeScreen] handleItemPress called with item:', item.title);

    // Don't open ExpandedItemView for items that are still being processed
    if (processingItemsComputed.isProcessing(item.id)) {
      console.log('⏳ [HomeScreen] Item is still processing, ignoring press');
      return;
    }

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
    const hasActiveFilters = filterComputed.hasActiveFilters();
    const isSyncing = syncStatusStore.isSyncing.get();

    // Special case for Archive view
    if (showArchived) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, isDarkMode && styles.emptyTitleDark]}>
            No archived items
          </Text>
          <Text style={[styles.emptySubtitle, isDarkMode && styles.emptySubtitleDark]}>
            Items you archive will appear here
          </Text>
        </View>
      );
    }

    // Determine if there are items that COULD be shown (before filtering)
    let unfilteredItems = allItems.filter(item => !item.is_deleted && !item.is_archived);
    if (selectedSpaceId) {
      unfilteredItems = unfilteredItems.filter(item => item.space_id === selectedSpaceId);
    }
    const hasAnyItems = unfilteredItems.length > 0;

    // If there are active filters and there ARE items (but they're being filtered out)
    if (hasActiveFilters && hasAnyItems) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, isDarkMode && styles.emptyTitleDark]}>
            No items match your filters
          </Text>
          <Text style={[styles.emptySubtitle, isDarkMode && styles.emptySubtitleDark]}>
            Your active filters are hiding all items in this view.
          </Text>
          <TouchableOpacity
            style={[styles.clearFiltersButton, isDarkMode && styles.clearFiltersButtonDark]}
            onPress={() => filterActions.clearAll()}
          >
            <Text style={[styles.clearFiltersButtonText, isDarkMode && styles.clearFiltersButtonTextDark]}>
              Clear Filters
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // If syncing and no items yet, show syncing message
    if (isSyncing && !hasAnyItems) {
      const syncMessage = getEmptyStateMessage('syncing');
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, isDarkMode && styles.emptyTitleDark]}>
            {syncMessage.title}
          </Text>
          <Text style={[styles.emptySubtitle, isDarkMode && styles.emptySubtitleDark]}>
            {syncMessage.subtitle}
          </Text>
        </View>
      );
    }

    // Default empty state (no items at all)
    const emptyMessage = getEmptyStateMessage(selectedSpaceId ? 'space' : 'home');
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

  // Count processing items
  const processingCount = useMemo(() => {
    return pendingItems.filter(p => p.status === 'pending' || p.status === 'processing').length;
  }, [pendingItems]);

  // Animated banner height with minimum display time
  const bannerHeight = useSharedValue(0);
  const [showBanner, setShowBanner] = useState(false);
  const bannerShowTimestamp = useRef<number | null>(null);

  useEffect(() => {
    if (processingCount > 0) {
      // Show banner
      if (!showBanner) {
        setShowBanner(true);
        bannerShowTimestamp.current = Date.now();
        bannerHeight.value = withTiming(40, {
          duration: 300,
          easing: Easing.out(Easing.ease),
        });
      }
    } else if (showBanner) {
      // Hide banner with minimum display time (500ms)
      const elapsed = bannerShowTimestamp.current ? Date.now() - bannerShowTimestamp.current : 500;
      const delay = Math.max(0, 500 - elapsed);

      setTimeout(() => {
        bannerHeight.value = withTiming(0, {
          duration: 300,
          easing: Easing.in(Easing.ease),
        }, () => {
          // After animation completes, hide the component
          // Use runOnJS to safely call state setter from animation callback
          runOnJS(setShowBanner)(false);
        });
      }, delay);
    }
  }, [processingCount, showBanner]);

  const bannerStyle = useAnimatedStyle(() => ({
    height: bannerHeight.value,
    overflow: 'hidden',
  }));

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <SimpleHeader />

      <FilterPills />

      {/* Processing count badge with slide animation */}
      {showBanner && (
        <Animated.View style={[bannerStyle, styles.processingBanner, isDarkMode && styles.processingBannerDark]}>
          <Text style={[styles.processingText, isDarkMode && styles.processingTextDark]}>
            Processing {processingCount} {processingCount === 1 ? 'item' : 'items'}...
          </Text>
        </Animated.View>
      )}

      {/* Single FlashList - filtering is done via filter store */}
      <FlashList
        ref={listRef}
        data={displayItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        extraData={metadataVersion}
        masonry
        numColumns={2}
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
  clearFiltersButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  clearFiltersButtonDark: {
    backgroundColor: '#0A84FF',
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  clearFiltersButtonTextDark: {
    color: '#FFFFFF',
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
  processingBanner: {
    backgroundColor: '#FFF9E6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  processingBannerDark: {
    backgroundColor: '#332800',
    borderBottomColor: '#665000',
  },
  processingText: {
    fontSize: 13,
    color: '#F57C00',
    fontWeight: '500',
    textAlign: 'center',
  },
  processingTextDark: {
    color: '#FFB74D',
  },
});
