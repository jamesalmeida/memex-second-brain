import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Dimensions
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { themeStore } from '../stores/theme';
import { itemsStore, itemsActions } from '../stores/items';
import { itemSpacesComputed } from '../stores/itemSpaces';
import ItemCard from './items/ItemCard';
import ExpandedItemView from './ExpandedItemView';
import { Item, Space } from '../types';
import { getEmptyStateMessage } from '../utils/mockData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ExpandedSpaceViewProps {
  space: Space | null;
  isVisible: boolean;
  cardPosition?: { x: number; y: number; width: number; height: number };
  onClose: () => void;
  onEdit?: () => void;
}

const ExpandedSpaceView = observer(({
  space,
  isVisible,
  cardPosition,
  onClose,
  onEdit,
}: ExpandedSpaceViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  
  // Animation values
  const animationProgress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [displaySpace, setDisplaySpace] = useState<Space | null>(null);
  
  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemCardPosition, setItemCardPosition] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const cardRefs = useRef<{ [key: string]: any }>({});

  // Get items for this space from the store (computed reactively via observer)
  const getSpaceItems = (spaceId: string): Item[] => {
    const allItems = itemsStore.items.get();
    const itemIdsInSpace = itemSpacesComputed.getItemIdsInSpace(spaceId);
    // Filter items that belong to this space
    return allItems.filter(item => itemIdsInSpace.includes(item.id));
  };

  // Compute items reactively - observer will auto-track changes
  const items = displaySpace ? getSpaceItems(displaySpace.id) : [];

  useEffect(() => {
    if (isVisible && space) {
      // Store the space for display
      setDisplaySpace(space);
      // Animate in
      setTimeout(() => {
        animationProgress.value = withSpring(1, {
          damping: 18,
          stiffness: 120,
          mass: 0.8,
        });
        opacity.value = withTiming(1, { duration: 200 });
      }, 50);
    } else if (!isVisible && displaySpace) {
      // Animate out
      animationProgress.value = withSpring(0, {
        damping: 20,
        stiffness: 100,
      }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setDisplaySpace)(null);
          runOnJS(setSearchQuery)('');
        }
      });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [isVisible, space]);

  const containerStyle = useAnimatedStyle(() => {
    const initialX = cardPosition?.x || SCREEN_WIDTH / 2;
    const initialY = cardPosition?.y || SCREEN_HEIGHT / 2;
    const initialWidth = cardPosition?.width || 100;
    const initialHeight = cardPosition?.height || 100;

    // Account for safe area insets only - let content extend under navigation
    const finalY = insets.top;
    const finalHeight = SCREEN_HEIGHT - insets.top; // Full height minus top safe area

    const x = interpolate(
      animationProgress.value,
      [0, 1],
      [initialX, 0]
    );
    const y = interpolate(
      animationProgress.value,
      [0, 1],
      [initialY, finalY]
    );
    const width = interpolate(
      animationProgress.value,
      [0, 1],
      [initialWidth, SCREEN_WIDTH]
    );
    const height = interpolate(
      animationProgress.value,
      [0, 1],
      [initialHeight, finalHeight]
    );

    return {
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const onRefresh = useCallback(() => {
    if (!displaySpace) return;
    setRefreshing(true);
    // Items are computed reactively, just end refreshing state after a delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, [displaySpace]);

  const handleItemPress = (item: Item) => {
    const cardRef = cardRefs.current[item.id];
    if (cardRef) {
      cardRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setItemCardPosition({ x: pageX, y: pageY, width, height });
        setSelectedItem(item);
      });
    } else {
      setSelectedItem(item);
    }
  };

  const handleItemLongPress = (item: Item) => {
    console.log('Item long pressed:', item.title);
  };

  const handleEditSpace = () => {
    if (onEdit) {
      onEdit();
    }
  };

  const handleChatWithSpace = () => {
    console.log('Chat with space:', displaySpace?.name);
  };

  const renderItem = ({ item }: { item: Item }) => (
    <View 
      ref={(ref) => cardRefs.current[item.id] = ref}
      collapsable={false}
      style={styles.itemWrapper}
    >
      <ItemCard 
        item={item} 
        onPress={handleItemPress}
        onLongPress={handleItemLongPress}
      />
    </View>
  );

  const EmptyState = () => {
    const emptyMessage = getEmptyStateMessage('space');
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={[styles.emptyTitle, isDarkMode && styles.emptyTitleDark]}>
          {emptyMessage.title}
        </Text>
        <Text style={[styles.emptySubtitle, isDarkMode && styles.emptySubtitleDark]}>
          {emptyMessage.subtitle}
        </Text>
      </View>
    );
  };

  // Filter items based on search and sort by created_at (newest first)
  const filteredItems = useMemo(() => {
    return items
      .filter(item =>
        searchQuery === '' ||
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
  }, [items, searchQuery]);

  if (!isVisible || !space) return null;
  const spaceToDisplay = displaySpace || space;
  if (!spaceToDisplay) return null;

  return (
    <View style={[styles.fullScreenOverlay, isDarkMode && styles.fullScreenOverlayDark]}>
      <SafeAreaView style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
        <Animated.View style={[containerStyle]}>
          <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <Animated.View style={[contentStyle, { flex: 1 }]}>
              {/* Header */}
              <View style={[styles.header, { backgroundColor: spaceToDisplay.color + '20', borderBottomColor: spaceToDisplay.color }]}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                
                <View style={styles.headerTitleContainer}>
                  <View style={[styles.colorIndicator, { backgroundColor: spaceToDisplay.color }]} />
                  <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]} numberOfLines={1}>
                    {spaceToDisplay.name}
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  <TouchableOpacity 
                    style={styles.headerActionButton} 
                    onPress={handleEditSpace}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="edit" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.headerActionButton} 
                    onPress={handleChatWithSpace}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="chat" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar */}
              <View style={[styles.searchContainer, isDarkMode && styles.searchContainerDark]}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
                  placeholder={`Search ${spaceToDisplay.name}`}
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Items Grid - extends under navigation for blur effect */}
              <FlashList
                data={filteredItems}
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
                    tintColor={spaceToDisplay.color}
                  />
                }
              />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Expanded Item View */}
        <ExpandedItemView
          item={selectedItem}
          isVisible={!!selectedItem}
          cardPosition={itemCardPosition}
          onClose={() => {
            setSelectedItem(null);
            setTimeout(() => {
              setItemCardPosition(undefined);
            }, 300);
          }}
          onChat={(item) => console.log('Chat with item:', item.title)}
          onEdit={(item) => console.log('Edit item:', item.title)}
          onArchive={(item) => console.log('Archive item:', item.title)}
          onDelete={async (item) => {
            console.log('Delete item:', item.title);
            // Actually delete the item from database and local storage
            await itemsActions.removeItemWithSync(item.id);
            // Items will auto-refresh via observer
            setSelectedItem(null);
          }}
          onShare={(item) => console.log('Share item:', item.title)}
          onSpaceChange={(item, spaceId) => console.log('Move item to space:', spaceId)}
          currentSpaceId={spaceToDisplay.id}
        />
      </SafeAreaView>
    </View>
  );
});

export default ExpandedSpaceView;

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, // Full screen, navigation will overlay on top
    zIndex: 1000, // Lower than navigation and bottom sheets
    backgroundColor: 'transparent', // Let the content provide background
  },
  fullScreenOverlayDark: {
    backgroundColor: 'transparent',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalContainerDark: {
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 70, // Account for bottom navigation
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerActionButton: {
    padding: 4,
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
  listContent: {
    paddingHorizontal: 4,
    paddingBottom: 100, // Extra padding so last items aren't hidden under nav
  },
  itemWrapper: {
    flex: 1,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
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
});