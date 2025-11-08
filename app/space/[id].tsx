import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Dimensions,
  Modal,
  Share,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { observer } from '@legendapp/state/react';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { themeStore } from '../../src/stores/theme';
import { expandedItemUIStore, expandedItemUIActions } from '../../src/stores/expandedItemUI';
import ItemCard from '../../src/components/items/ItemCard';
import ExpandedItemView from '../../src/components/ExpandedItemView';
import { Item, Space } from '../../src/types';
import { getEmptyStateMessage } from '../../src/utils/mockData';
import { spacesComputed } from '../../src/stores/spaces';
import { itemsStore, itemsActions } from '../../src/stores/items';
import { processingItemsComputed } from '../../src/stores/processingItems';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SpaceDetailScreen = observer(() => {
  const { 
    id, 
    cardX, 
    cardY, 
    cardWidth, 
    cardHeight,
    spaceColor,
    spaceName 
  } = useLocalSearchParams();
  const router = useRouter();
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  
  // Animation values
  const animationProgress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [modalVisible, setModalVisible] = useState(true);

  // Get space data from store
  const spaces = spacesComputed.spaces();
  const space = spaces.find(s => s.id === id);

  // State
  const allItems = itemsStore.items.get();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const expandedItemSheetRef = useRef<BottomSheet>(null);

  // If space not found, go back
  useEffect(() => {
    if (!space) {
      router.back();
    }
  }, [space]);

  // Parse animation params
  const initialX = cardX ? Number(cardX) : SCREEN_WIDTH / 2;
  const initialY = cardY ? Number(cardY) : SCREEN_HEIGHT / 2;
  const initialWidth = cardWidth ? Number(cardWidth) : 100;
  const initialHeight = cardHeight ? Number(cardHeight) : 100;

  useEffect(() => {
    // Animate in
    setTimeout(() => {
      animationProgress.value = withSpring(1, {
        damping: 20,
        stiffness: 100,
      });
      opacity.value = withTiming(1, { duration: 200 });
    }, 50);
  }, []);

  // Observe expandedItemUIStore and update selectedItem when it changes
  useEffect(() => {
    const unsubscribe = expandedItemUIStore.currentItem.onChange(({ value }) => {
      console.log('📱 [SpaceDetailScreen] expandedItemUIStore changed, new value:', value?.title || 'null');
      if (value) {
        console.log('📱 [SpaceDetailScreen] Setting selectedItem:', value.title);
        setSelectedItem(value);
      } else {
        console.log('📱 [SpaceDetailScreen] Clearing selectedItem');
        setSelectedItem(null);
      }
    });

    // Check initial value on mount
    const initialItem = expandedItemUIStore.currentItem.get();
    if (initialItem) {
      console.log('📱 [SpaceDetailScreen] Initial item in store:', initialItem.title);
      setSelectedItem(initialItem);
    }

    return unsubscribe;
  }, []);

  const handleClose = () => {
    // Animate out
    animationProgress.value = withSpring(0, {
      damping: 20,
      stiffness: 120,
    }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(() => {
          router.back();
        })();
      }
    });
    opacity.value = withTiming(0, { duration: 150 });
  };

  const containerStyle = useAnimatedStyle(() => {
    const finalY = insets.top;
    const finalHeight = SCREEN_HEIGHT - insets.top - insets.bottom;

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
    setRefreshing(true);
    // TODO: Refresh from backend
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleItemPress = (item: Item) => {
    // Don't open ExpandedItemView for items that are still being processed
    if (processingItemsComputed.isProcessing(item.id)) {
      console.log('⏳ [SpaceDetail] Item is still processing, ignoring press');
      return;
    }

    setSelectedItem(item);
    // ExpandedItemView will handle opening via its controlled index prop
  };

  const handleItemLongPress = (item: Item) => {
    console.log('Item long pressed:', item.title);
  };

  const handleEditSpace = () => {
    if (!space) return;
    console.log('Edit space:', space.name);
  };

  const handleChatWithSpace = () => {
    if (!space) return;
    console.log('Chat with space:', space.name);
  };

  const renderItem = ({ item, index }: { item: Item; index: number }) => (
    <View style={index % 2 === 0 ? styles.leftColumn : styles.rightColumn}>
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

  // Filter items for this space based on search and sort by created_at (newest first)
  const filteredItems = useMemo(() => {
    if (!space) return [];

    // Get items for this space only
    const spaceItems = allItems.filter(item =>
      item.space_id === space.id && !item.is_deleted && !item.is_archived
    );

    // Apply search filter
    return spaceItems
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
  }, [allItems, space, searchQuery]);

  if (!space) {
    return null;
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
        <Animated.View style={[containerStyle]}>
          <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <Animated.View style={[contentStyle, { flex: 1 }]}>
              {/* Header */}
              <View style={[styles.header, { backgroundColor: space.color + '20', borderBottomColor: space.color }]}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                
                <View style={styles.headerTitleContainer}>
                  <View style={[styles.colorIndicator, { backgroundColor: space.color }]} />
                  <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]} numberOfLines={1}>
                    {space.name}
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
                  placeholder={`Search ${space.name}`}
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Items Grid */}
              <FlatList
                data={filteredItems}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={EmptyState}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={space.color}
                  />
                }
              />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Expanded Item View */}
        <ExpandedItemView
          ref={expandedItemSheetRef}
          item={selectedItem}
          onClose={() => {
            setSelectedItem(null);
            expandedItemUIActions.closeExpandedItem();
          }}
          onChat={(item) => console.log('Chat with item:', item.title)}
          onEdit={(item) => console.log('Edit item:', item.title)}
          onArchive={(item) => console.log('Archive item:', item.title)}
          onDelete={async (item) => {
            console.log('Delete item:', item.title);
            await itemsActions.removeItemWithSync(item.id);
            setSelectedItem(null);
          }}
          onShare={async (item) => {
            if (item.url) {
              try {
                await Share.share({
                  url: item.url,
                  message: item.title,
                });
              } catch (error) {
                console.error('Error sharing:', error);
              }
            } else {
              Alert.alert('No URL', 'This item doesn\'t have a URL to share');
            }
          }}
          onSpaceChange={(item, spaceId) => console.log('Move item to space:', spaceId)}
          currentSpaceId={space.id}
        />
      </SafeAreaView>
    </Modal>
  );
});

export default SpaceDetailScreen;

const styles = StyleSheet.create({
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
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },
  leftColumn: {
    marginRight: 6,
  },
  rightColumn: {
    marginLeft: 6,
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