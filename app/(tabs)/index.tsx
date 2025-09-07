import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, RefreshControl, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  interpolate
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../../src/stores/theme';
import { itemsStore, itemsActions } from '../../src/stores/items';
import ItemCard from '../../src/components/ItemCard';
import ExpandedItemView from '../../src/components/ExpandedItemView';
import { Item } from '../../src/types';
import { generateMockItems, getEmptyStateMessage } from '../../src/utils/mockData';
import { useDynamicTextContrast } from '../../src/hooks/useDynamicTextContrast';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const HomeScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const showMockData = themeStore.showMockData.get();
  const allItems = itemsStore.items.get();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const cardRefs = useRef<{ [key: string]: any }>({});
  
  // Dynamic contrast for search bar
  const {
    handleScroll,
    animatedTextStyle,
    placeholderColor,
    shouldUseDarkText,
  } = useDynamicTextContrast(isDarkMode, {
    lightThreshold: 0.55,
    darkThreshold: 0.45,
    transitionDuration: 250,
    scrollSampleRate: 50,
  });

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

  // Clear search query
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
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
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 53 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={EmptyState}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        }
      />

      {/* Floating Search Bar with Dynamic Contrast */}
      <View style={[styles.searchContainer, { 
        position: 'absolute',
        top: insets.top - 12,
        left: 4,
        right: 4,
        zIndex: 10,
        borderBottomColor: shouldUseDarkText ? '#FF6B35' : '#FF8A65',
      }]}>
        <AnimatedTextInput
          style={[styles.searchInput, animatedTextStyle]}
          placeholder="Search Everything..."
          placeholderTextColor={placeholderColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSearch}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons 
              name="close" 
              size={20} 
              color={shouldUseDarkText ? '#000000' : '#FFFFFF'} 
            />
          </TouchableOpacity>
        )}
      </View>

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginHorizontal: 4,
    marginTop: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 0,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 0,
    paddingRight: 36, // Make room for clear button
    paddingTop: 8,
    paddingBottom: 0,
    marginBottom: -12,
    fontSize: 26,
    // fontFamily: 'System',
    // REMOVE THIS AFTER TESTING
    // backgroundColor: 'red',
  },
  clearButton: {
    position: 'absolute',
    right: 4,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingHorizontal: 4,
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