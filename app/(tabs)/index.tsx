import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../../src/stores/theme';
import { itemsStore, itemsActions } from '../../src/stores/items';
import { itemTypeMetadataComputed } from '../../src/stores/itemTypeMetadata';
import { expandedItemUIActions } from '../../src/stores/expandedItemUI';
import { filterStore, filterActions, filterComputed } from '../../src/stores/filter';
import { syncStatusStore } from '../../src/stores/syncStatus';
import { pendingItemsStore, PendingItemDisplay } from '../../src/stores/pendingItems';
import { processingItemsComputed } from '../../src/stores/processingItems';
import ItemCard from '../../src/components/items/ItemCard';
import ProcessingItemCard from '../../src/components/items/ProcessingItemCard';
import { Item } from '../../src/types';
import { getEmptyStateMessage } from '../../src/utils/mockData';
import { useRadialMenu } from '../../src/contexts/RadialMenuContext';
import { spacesComputed } from '../../src/stores/spaces';
import SimpleHeader from '../../src/components/SimpleHeader';
import FilterPills from '../../src/components/FilterPills';
import { useToast } from '../../src/contexts/ToastContext';

// Union type for items that can be displayed in the grid
type DisplayItem = Item | { _isPending: true; pending: PendingItemDisplay };

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
  const searchQuery = filterStore.searchQuery.get();
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<any>(null);
  const previousItemCount = useRef(allItems.length);
  const previousPendingCount = useRef(0);
  const lastToastTimestamp = useRef(0);
  const isInitialMount = useRef(true);
  const { showToast } = useToast();

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

  // Show toast when new pending items are detected
  const activePendingItems = useMemo(() => {
    return pendingItems.filter(p => p.status === 'pending' || p.status === 'processing');
  }, [pendingItems]);

  useEffect(() => {
    const currentCount = activePendingItems.length;
    const previousCount = previousPendingCount.current;
    const now = Date.now();

    // Show toast only when new pending items appear
    // Use timestamp debounce (2 seconds) to prevent duplicate toasts from rapid state updates
    if (currentCount > previousCount && currentCount > 0) {
      const timeSinceLastToast = now - lastToastTimestamp.current;
      if (timeSinceLastToast > 2000) {
        const newCount = currentCount - previousCount;
        lastToastTimestamp.current = now;
        showToast({
          message: `${newCount} new ${newCount === 1 ? 'item' : 'items'} from Share Sheet`,
          type: 'info',
          duration: 3000,
        });
      }
    }

    previousPendingCount.current = currentCount;
  }, [activePendingItems.length, showToast]);

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
  }, [selectedContentType, selectedTags, sortOrder, selectedSpaceId, showArchived, searchQuery, insets.top]);

  // Filter items based on all filter criteria
  const displayItems = useMemo((): DisplayItem[] => {
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

    // Apply search query filter
    if (searchQuery && searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => {
        // Search in URL
        if (item.url?.toLowerCase().includes(query)) return true;

        // Search in title (if it exists)
        if (item.title && item.title.toLowerCase().includes(query)) return true;

        // Search in tags
        if (item.tags?.some(tag => tag.toLowerCase().includes(query))) return true;

        // Search in content type
        if (item.content_type?.toLowerCase().includes(query)) return true;

        return false;
      });
    }

    // Sort by created_at based on sortOrder
    const sortedItems = filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      if (sortOrder === 'recent') {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });

    // Add pending items as skeleton cards at the top (only if not in archived view and no filters)
    // Skip showing skeleton cards if we're in archived view or have search/filter active
    if (!showArchived && !searchQuery && selectedContentType === null && selectedTags.length === 0) {
      const pendingCards: DisplayItem[] = activePendingItems.map(pending => ({
        _isPending: true as const,
        pending,
      }));

      // Put pending items at the top
      return [...pendingCards, ...sortedItems];
    }

    return sortedItems;
  }, [allItems, activePendingItems, selectedContentType, selectedTags, sortOrder, selectedSpaceId, showArchived, searchQuery]);

  // Track metadata changes to force FlashList re-renders when images are added/removed
  const metadataVersion = itemTypeMetadataComputed.metadataVersion();

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

  // Helper to check if item is a pending placeholder
  const isPendingItem = (item: DisplayItem): item is { _isPending: true; pending: PendingItemDisplay } => {
    return '_isPending' in item && item._isPending === true;
  };

  // Helper to extract URL title for display
  const extractUrlTitle = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // Return hostname without www
      return urlObj.hostname.replace('www.', '');
    } catch {
      // If URL parsing fails, return truncated URL
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  };

  const renderItem = ({ item }: { item: DisplayItem }) => {
    // Handle pending placeholder items - show ProcessingItemCard
    if (isPendingItem(item)) {
      return (
        <View style={{ width: '100%', paddingHorizontal: 4, paddingBottom: 8 }}>
          <ProcessingItemCard title={extractUrlTitle(item.pending.url)} />
        </View>
      );
    }

    // Regular item
    return (
      <View style={{ width: '100%', paddingHorizontal: 4, paddingBottom: 8 }}>
        <ItemCard
          item={item}
          onPress={handleItemPress}
          onLongPress={handleItemLongPress}
        />
      </View>
    );
  };

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

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <SimpleHeader />

      <FilterPills />

      {/* Single FlashList - filtering is done via filter store */}
      <FlashList
        ref={listRef}
        data={displayItems}
        renderItem={renderItem}
        keyExtractor={(item) => isPendingItem(item) ? `pending-${item.pending.id}` : item.id}
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
});
