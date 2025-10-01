import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../../src/stores/theme';
import { itemsStore, itemsActions } from '../../src/stores/items';
import { chatUIActions } from '../../src/stores/chatUI';
import ItemCard from '../../src/components/items/ItemCard';
import ExpandedItemView from '../../src/components/ExpandedItemView';
import { Item } from '../../src/types';
import { generateMockItems, getEmptyStateMessage } from '../../src/utils/mockData';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding

const HomeScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const showMockData = themeStore.showMockData.get();
  const allItems = itemsStore.items.get();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const cardRefs = useRef<{ [key: string]: any }>({});

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
    // Get the position of the card for animation
    const cardRef = cardRefs.current[item.id];
    if (cardRef) {
      cardRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setCardPosition({ x: pageX, y: pageY, width, height });
        setSelectedItem(item);
      });
    } else {
      // Fallback if ref not available
      setSelectedItem(item);
    }
  };

  const handleItemLongPress = (item: Item) => {
    // TODO: Show quick actions menu
    console.log('Item long pressed:', item.title);
  };

  const renderItem = ({ item }: { item: Item }) => (
    <View 
      ref={(ref) => cardRefs.current[item.id] = ref}
      collapsable={false}
      style={{ width: '100%', paddingHorizontal: 4, paddingBottom: 8 }}
    >
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
        data={displayItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        masonry
        numColumns={2}
        estimatedItemSize={200}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top, paddingHorizontal: isDarkMode ? -4 : 4 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        }
      />

      {/* Expanded Item View */}
      <ExpandedItemView
        item={selectedItem}
        isVisible={!!selectedItem}
        cardPosition={cardPosition}
        onClose={() => {
          // Just set selectedItem to null to trigger closing animation
          // The component will handle the rest
          setSelectedItem(null);
        }}
        onChat={(item) => {
          // Open chat for this item using the chatUI store
          chatUIActions.openChat(item);
        }}
        onEdit={(item) => console.log('Edit item:', item.title)}
        onArchive={(item) => console.log('Archive item:', item.title)}
        onDelete={async (item) => {
          console.log('Delete item:', item.title);
          await itemsActions.removeItemWithSync(item.id);
          setSelectedItem(null);
        }}
        onShare={(item) => console.log('Share item:', item.title)}
        onSpaceChange={(item, spaceId) => console.log('Move item to space:', spaceId)}
        currentSpaceId={null}
      />
    </View>
  );
});

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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