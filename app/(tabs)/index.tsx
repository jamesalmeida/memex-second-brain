import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../../src/stores/theme';
import { itemsStore, itemsActions } from '../../src/stores/items';
import { expandedItemUIActions } from '../../src/stores/expandedItemUI';
import ItemCard from '../../src/components/items/ItemCard';
// Expanded item view is now rendered at the tab layout level overlay
import { Item } from '../../src/types';
import { generateMockItems, getEmptyStateMessage } from '../../src/utils/mockData';
import { useRadialMenu } from '../../src/contexts/RadialMenuContext';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding

interface HomeScreenProps {
  onExpandedItemOpen?: () => void;
  onExpandedItemClose?: () => void;
}

const HomeScreen = observer(({ onExpandedItemOpen, onExpandedItemClose }: HomeScreenProps = {}) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const showMockData = themeStore.showMockData.get();
  const allItems = itemsStore.items.get();
  const [refreshing, setRefreshing] = useState(false);
  // Expanded item is controlled at the TabLayout overlay via expandedItemUI store
  const listRef = useRef<FlashList<Item>>(null);
  const previousItemCount = useRef(allItems.length);

  // Get radial menu state to disable scroll when menu is active
  const { shouldDisableScroll } = useRadialMenu();

  // Initialize items on first load
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

    initializeItems();
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

  // Filter items based on showMockData toggle and sort by created_at (newest first)
  const displayItems = useMemo(() => {
    let filtered;
    if (showMockData) {
      filtered = allItems; // Show all items including mock
    } else {
      filtered = allItems.filter(item => !item.isMockData); // Only show real items
    }

    // Sort by created_at descending (newest first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }, [allItems, showMockData]);

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
      {/* Items Grid - extends full height */}
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
});