import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TextInput, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../../src/stores/theme';
import { spacesStore, spacesActions, spacesComputed } from '../../src/stores/spaces';
import SpaceCard from '../../src/components/SpaceCard';
import SpaceChatSheet, { SpaceChatSheetRef } from '../../src/components/SpaceChatSheet';
import EditSpaceSheet, { EditSpaceSheetRef } from '../../src/components/EditSpaceSheet';
import { Space } from '../../src/types';
import { getEmptyStateMessage } from '../../src/utils/mockData';
import { useDrawer } from '../../src/contexts/DrawerContext';

interface SpacesScreenProps {
  onSpaceOpen?: (spaceId: string) => void;
  onSpaceClose?: () => void;
}

const SpacesScreen = observer(({ onSpaceOpen, onSpaceClose }: SpacesScreenProps = {}) => {
  // Get drawer from context directly instead of via props
  const { openDrawer } = useDrawer();
  console.log('📦 [SpacesScreen] Component rendered, openDrawer from context:', typeof openDrawer);

  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const allSpaces = spacesComputed.activeSpaces();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const spaceChatSheetRef = useRef<SpaceChatSheetRef>(null);
  const cardRefs = useRef<{ [key: string]: View | null }>({});
  const editSpaceSheetRef = useRef<EditSpaceSheetRef>(null);

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
    setSelectedSpace(space);
    spaceChatSheetRef.current?.openWithSpace(space.name);
    onSpaceOpen?.(space.id);
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
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Spaces Grid - extends full height */}
      <FlashList
        data={filteredSpaces}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        masonry
        numColumns={2}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 60 }]}
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

      {/* Header Bar matching HeaderBar.tsx */}
      <View style={[
        styles.headerBar,
        isDarkMode && styles.headerBarDark,
        { paddingTop: insets.top, paddingBottom: 10 }
      ]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          onPress={openDrawer}
          style={styles.hamburgerButton}
          activeOpacity={0.7}
        >
          <View style={styles.hamburgerIcon}>
            <View style={[styles.hamburgerLine, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', marginTop: 4 }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', marginTop: 4 }]} />
          </View>
        </TouchableOpacity>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
            placeholder="Search Spaces..."
            placeholderTextColor={isDarkMode ? '#999999' : '#666666'}
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
                size={18}
                color={isDarkMode ? '#999999' : '#666666'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Space Chat Sheet */}
      <SpaceChatSheet
        ref={spaceChatSheetRef}
        onClose={() => {
          setSelectedSpace(null);
          onSpaceClose?.();
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
    paddingBottom: 85, // Account for nav bar height
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    zIndex: 10,
  },
  headerBarDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  hamburgerButton: {
    paddingRight: 12,
    paddingLeft: 12,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  hamburgerIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  searchInputContainer: {
    flex: 1,
    position: 'relative',
    paddingBottom: 4,
    marginLeft: 10,
  },
  searchInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    paddingVertical: 0,
    paddingRight: 36,
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  clearButton: {
    position: 'absolute',
    right: 0,
    top: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});