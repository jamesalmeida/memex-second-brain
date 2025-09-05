import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../../src/stores/theme';
import { spacesStore, spacesActions, spacesComputed } from '../../src/stores/spaces';
import SpaceCard from '../../src/components/SpaceCard';
import ExpandedSpaceView from '../../src/components/ExpandedSpaceView';
import { Space } from '../../src/types';
import { getSpaceItemCount, getEmptyStateMessage } from '../../src/utils/mockData';

const SpacesScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const spaces = spacesComputed.spaces();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const cardRefs = useRef<{ [key: string]: any }>({});

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
      });
    } else {
      // Fallback if ref not available
      setSelectedSpace(space);
    }
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
        data={spaces}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        masonry
        numColumns={2}
        estimatedItemSize={150}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 100 }]}
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

      {/* Floating Header */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 16 }, isDarkMode && styles.floatingHeaderDark]}>
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
          Your Spaces
        </Text>
        <Text style={[styles.headerSubtitle, isDarkMode && styles.headerSubtitleDark]}>
          Organize your knowledge into collections
        </Text>
      </View>

      {/* Expanded Space View */}
      <ExpandedSpaceView
        space={selectedSpace}
        isVisible={!!selectedSpace}
        cardPosition={cardPosition}
        onClose={() => {
          setSelectedSpace(null);
          // Keep cardPosition for closing animation
          setTimeout(() => {
            setCardPosition(undefined);
          }, 300);
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
});