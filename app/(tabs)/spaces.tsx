import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useRouter } from 'expo-router';
import { themeStore } from '../../src/stores/theme';
import SpaceCard from '../../src/components/SpaceCard';
import ExpandedSpaceView from '../../src/components/ExpandedSpaceView';
import { Space } from '../../src/types';
import { generateMockSpaces, getSpaceItemCount, getEmptyStateMessage } from '../../src/utils/mockData';

const SpacesScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>(generateMockSpaces());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const cardRefs = useRef<{ [key: string]: any }>({});

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setSpaces(generateMockSpaces());
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

  const renderItem = ({ item, index }: { item: Space; index: number }) => (
    <View 
      style={index % 2 === 0 ? styles.leftColumn : styles.rightColumn}
      ref={(ref) => cardRefs.current[item.id] = ref}
      collapsable={false}
    >
      <SpaceCard 
        space={item} 
        itemCount={getSpaceItemCount(item.id)}
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
          Your Spaces
        </Text>
        <Text style={[styles.headerSubtitle, isDarkMode && styles.headerSubtitleDark]}>
          Organize your knowledge into collections
        </Text>
      </View>

      {/* Spaces Grid */}
      <FlatList
        data={spaces}
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
            tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => console.log('Create new space')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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