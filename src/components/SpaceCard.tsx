import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { Space } from '../types';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding

interface SpaceCardProps {
  space: Space;
  itemCount: number;
  onPress: (space: Space) => void;
}

const SpaceCard = observer(({ space, itemCount, onPress }: SpaceCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDarkMode && styles.cardDark,
        { borderTopColor: space.color }
      ]}
      onPress={() => onPress(space)}
      activeOpacity={0.7}
    >
      {/* Color indicator */}
      <View style={[styles.colorBar, { backgroundColor: space.color }]} />

      {/* Space Content */}
      <View style={styles.cardContent}>
        <Text style={[styles.name, isDarkMode && styles.nameDark]} numberOfLines={1}>
          {space.name}
        </Text>
        
        {(space.description || space.desc) && (
          <Text style={[styles.description, isDarkMode && styles.descriptionDark]} numberOfLines={2}>
            {space.description || space.desc}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={[styles.itemCountBadge, { backgroundColor: space.color + '20' }]}>
            <Text style={[styles.itemCount, { color: space.color }]}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>
      </View>

      {/* Space Icon/Emoji */}
      <View style={[styles.iconContainer, { backgroundColor: space.color + '15' }]}>
        <Text style={styles.icon}>{space.icon || '📁'}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default SpaceCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderTopWidth: 3,
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.3,
  },
  colorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cardContent: {
    padding: 16,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  nameDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  descriptionDark: {
    color: '#999999',
  },
  footer: {
    marginTop: 'auto',
  },
  itemCountBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
});