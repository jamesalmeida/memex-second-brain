import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TextInput, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../../src/stores/theme';
import { spacesStore, spacesActions, spacesComputed } from '../../src/stores/spaces';
import SpaceCard from '../../src/components/SpaceCard';
import ExpandedSpaceView from '../../src/components/ExpandedSpaceView';
import EditSpaceSheet, { EditSpaceSheetRef } from '../../src/components/EditSpaceSheet';
import { Space } from '../../src/types';
import { getSpaceItemCount, getEmptyStateMessage } from '../../src/utils/mockData';
import { useDynamicTextContrast } from '../../src/hooks/useDynamicTextContrast';
import { useDrawer } from '../../src/contexts/DrawerContext';
import { useDeviceType, getGridColumns } from '../../src/utils/device';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface SpacesScreenProps {
  onSpaceOpen?: (spaceId: string) => void;
  onSpaceClose?: () => void;
}

const SpacesScreen = observer(({ onSpaceOpen, onSpaceClose }: SpacesScreenProps = {}) => {
  // Get drawer from context directly instead of via props
  const { openDrawer, toggleDrawer, isDrawerVisible } = useDrawer();
  console.log('📦 [SpacesScreen] Component rendered, openDrawer from context:', typeof openDrawer);

  // Get device type info
  const { isPersistentDrawer, isIPad, isLandscape, screenWidth } = useDeviceType();
  
  // Calculate initial container width accounting for drawer
  const DRAWER_WIDTH = 280;
  const initialWidth = isPersistentDrawer && isDrawerVisible 
    ? screenWidth - DRAWER_WIDTH 
    : screenWidth;
  
  // Measure actual container width to account for drawer
  const [containerWidth, setContainerWidth] = useState(initialWidth);
  
  // Calculate dynamic grid columns based on actual available width
  const numColumns = getGridColumns(containerWidth, isDrawerVisible, isPersistentDrawer);

  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const allSpaces = spacesComputed.spaces();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const cardRefs = useRef<{ [key: string]: any }>({});
  const editSpaceSheetRef = useRef<EditSpaceSheetRef>(null);
  
  // Update container width when drawer visibility changes
  useEffect(() => {
    const newWidth = isPersistentDrawer && isDrawerVisible 
      ? screenWidth - DRAWER_WIDTH 
      : screenWidth;
    if (newWidth !== containerWidth) {
      setContainerWidth(newWidth);
    }
  }, [isPersistentDrawer, isDrawerVisible, screenWidth]);

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

  // Clear search query
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);
  
  // Filter spaces based on search query
  const filteredSpaces = useMemo(() => {
    if (!searchQuery.trim()) {
      return allSpaces;
    }
    
    const query = searchQuery.toLowerCase();
    return allSpaces.filter(space => 
      space.name.toLowerCase().includes(query) ||
      (space.description && space.description.toLowerCase().includes(query)) ||
      (space.desc && space.desc.toLowerCase().includes(query))
    );
  }, [allSpaces, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh - in production this would fetch from API
    setTimeout(() => {
      // Don't regenerate spaces, just refresh the view
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleSpacePress = (space: Space) => {
    // Get the position of the card for animation
    const cardRef = cardRefs.current[space.id];
    if (cardRef) {
      cardRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setCardPosition({ x: pageX, y: pageY, width, height });
        setSelectedSpace(space);
        onSpaceOpen?.(space.id);
      });
    } else {
      // Fallback if ref not available
      setSelectedSpace(space);
      onSpaceOpen?.(space.id);
    }
  };

  const handleSpaceEdit = (space: Space) => {
    editSpaceSheetRef.current?.openWithSpace(space);
  };

  const renderItem = ({ item }: { item: Space }) => (
    <View 
      style={{ width: '100%', paddingHorizontal: 4, paddingBottom: 8 }}
      ref={(ref) => cardRefs.current[item.id] = ref}
      collapsable={false}
    >
      <SpaceCard 
        space={item} 
        itemCount={item.item_count || 0}
        onPress={handleSpacePress}
      />
    </View>
  );

  const EmptyState = () => {
    const emptyMessage = getEmptyStateMessage('space');
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={[styles.emptyTitle, isDarkMode && styles.emptyTitleDark]}>
          No spaces yet
        </Text>
        <Text style={[styles.emptySubtitle, isDarkMode && styles.emptySubtitleDark]}>
          Create spaces to organize your items into projects or topics.
        </Text>
      </View>
    );
  };

  return (
    <View 
      style={[styles.container, isDarkMode && styles.containerDark]}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0 && width !== containerWidth) {
          setContainerWidth(width);
        }
      }}
    >
      {/* Spaces Grid - extends full height */}
      <FlashList
        data={filteredSpaces}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        key={`spaces-${numColumns}`}
        masonry
        numColumns={numColumns}
        estimatedItemSize={150}
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
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isPersistentDrawer ? (isDrawerVisible ? "Hide sidebar" : "Show sidebar") : "Open menu"}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          onPress={isPersistentDrawer ? toggleDrawer : openDrawer}
          style={styles.menuButton}
          activeOpacity={0.7}
        >
          {/* For iPad persistent drawer, show different icon when drawer is hidden */}
          {isPersistentDrawer && !isDrawerVisible ? (
            <>
              <View style={[styles.menuLine, { backgroundColor: shouldUseDarkText ? '#000000' : '#FFFFFF' }]} />
              <View style={[styles.menuLine, { backgroundColor: shouldUseDarkText ? '#000000' : '#FFFFFF', marginTop: 6 }]} />
            </>
          ) : (
            <>
              <View style={[styles.menuLine, { backgroundColor: shouldUseDarkText ? '#000000' : '#FFFFFF' }]} />
              <View style={[styles.menuLineShort, { backgroundColor: shouldUseDarkText ? '#000000' : '#FFFFFF' }]} />
            </>
          )}
        </TouchableOpacity>
        <AnimatedTextInput
          style={[styles.searchInput, animatedTextStyle]}
          placeholder="Search Spaces..."
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

      {/* Expanded Space View */}
      <ExpandedSpaceView
        space={selectedSpace}
        isVisible={!!selectedSpace}
        cardPosition={cardPosition}
        onClose={() => {
          setSelectedSpace(null);
          onSpaceClose?.();
          // Keep cardPosition for closing animation
          setTimeout(() => {
            setCardPosition(undefined);
          }, 300);
        }}
        onEdit={() => {
          if (selectedSpace) {
            handleSpaceEdit(selectedSpace);
            setSelectedSpace(null);
          }
        }}
      />
      
      {/* Edit Space Sheet */}
      <EditSpaceSheet
        ref={editSpaceSheetRef}
        onSpaceUpdated={(space) => {
          // Refresh the spaces list if needed
          console.log('Space updated:', space.name);
        }}
        onSpaceDeleted={(spaceId) => {
          // Refresh the spaces list if needed
          console.log('Space deleted:', spaceId);
        }}
      />
    </View>
  );
});

export default SpacesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    zIndex: 1,
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(245, 245, 245, 0.95)',
    zIndex: 10,
  },
  floatingHeaderDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  headerSubtitleDark: {
    color: '#999999',
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
  menuButton: {
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 4,
  },
  menuLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  menuLineShort: {
    width: 12,
    height: 2,
    borderRadius: 1,
    marginTop: 6,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 0,
    paddingRight: 36, // Make room for clear button
    paddingTop: 8,
    paddingBottom: 0,
    marginBottom: -12,
    fontSize: 26,
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
});