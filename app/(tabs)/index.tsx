import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, RefreshControl, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../src/stores/theme';
import { itemsStore, itemsActions } from '../../src/stores/items';
import ItemCard from '../../src/components/ItemCard';
import ExpandedItemView from '../../src/components/ExpandedItemView';
import { Item } from '../../src/types';
import { generateMockItems, getEmptyStateMessage } from '../../src/utils/mockData';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding

const HomeScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const showMockData = themeStore.showMockData.get();
  const allItems = itemsStore.items.get();
  const [searchQuery, setSearchQuery] = useState('');
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

  // Filter items based on showMockData toggle
  const displayItems = useMemo(() => {
    if (showMockData) {
      return allItems; // Show all items including mock
    } else {
      return allItems.filter(item => !item.isMockData); // Only show real items
    }
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
      style={{ width: '100%', paddingHorizontal: 6, paddingBottom: 12 }}
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
      {/* Search Bar */}
      <View style={[styles.searchContainer, isDarkMode && styles.searchContainerDark]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
          placeholder="Search your second brain..."
          placeholderTextColor={isDarkMode ? '#666' : '#999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Items Grid */}
      <FlashList
        data={displayItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        masonry
        numColumns={2}
        estimatedItemSize={200}
        contentContainerStyle={styles.listContent}
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

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => console.log('Open add item sheet')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

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
        onChat={(item) => console.log('Chat with item:', item.title)}
        onEdit={(item) => console.log('Edit item:', item.title)}
        onArchive={(item) => console.log('Archive item:', item.title)}
        onDelete={(item) => {
          console.log('Delete item:', item.title);
          itemsActions.removeItem(item.id);
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchContainerDark: {
    backgroundColor: '#1C1C1E',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    padding: 4,
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
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