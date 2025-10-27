import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { observer } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { filterStore, filterActions } from '../stores/filter';
import { ContentType } from '../types';

// Map content types to display names
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  bookmark: 'Bookmark',
  youtube: 'YouTube',
  x: 'X/Twitter',
  instagram: 'Instagram',
  reddit: 'Reddit',
  note: 'Note',
  movie: 'Movie',
  tv: 'TV Show',
  product: 'Product',
};

const FilterPills = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const selectedContentType = filterStore.selectedContentType.get();
  const selectedTags = filterStore.selectedTags.get();

  // Don't render anything if no filters are active
  if (!selectedContentType && selectedTags.length === 0) {
    return null;
  }

  const handleRemoveContentType = () => {
    filterActions.clearContentType();
  };

  const handleRemoveTag = (tag: string) => {
    filterActions.toggleTag(tag);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {selectedContentType && (
          <View style={[styles.pill, isDarkMode && styles.pillDark]}>
            <Text style={[styles.pillText, isDarkMode && styles.pillTextDark]}>
              {CONTENT_TYPE_LABELS[selectedContentType] || selectedContentType}
            </Text>
            <TouchableOpacity
              onPress={handleRemoveContentType}
              style={styles.removeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={isDarkMode ? '#8E8E93' : '#666'}
              />
            </TouchableOpacity>
          </View>
        )}

        {selectedTags.map((tag) => (
          <View key={tag} style={[styles.pill, styles.tagPill, isDarkMode && styles.pillDark]}>
            <Text style={[styles.pillText, isDarkMode && styles.pillTextDark]}>
              {tag}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveTag(tag)}
              style={styles.removeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={isDarkMode ? '#8E8E93' : '#666'}
              />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export default FilterPills;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 8,
  },
  containerDark: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#2C2C2E',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E8E8',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  pillDark: {
    backgroundColor: '#2C2C2E',
  },
  tagPill: {
    // Could add different styling for tags if needed
  },
  pillText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  pillTextDark: {
    color: '#F2F2F7',
  },
  removeButton: {
    padding: 2,
  },
});
