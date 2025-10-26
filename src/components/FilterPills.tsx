import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { filterStore, filterActions } from '../stores/filter';
import { CONTENT_TYPES } from '../constants';
import { ContentType } from '../types';

const FilterPills = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const selectedContentType = filterStore.selectedContentType.get();
  const selectedTags = filterStore.selectedTags.get();

  // If no filters are active, don't render anything
  if (!selectedContentType && selectedTags.length === 0) {
    return null;
  }

  const handleRemoveContentType = () => {
    filterActions.clearContentType();
  };

  const handleRemoveTag = (tag: string) => {
    filterActions.toggleTag(tag); // Toggle off the tag
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Content Type Pill */}
        {selectedContentType && (
          <View style={[styles.pill, isDarkMode && styles.pillDark]}>
            <Text style={[styles.pillText, isDarkMode && styles.pillTextDark]}>
              {CONTENT_TYPES[selectedContentType as ContentType]?.label || selectedContentType}
            </Text>
            <TouchableOpacity
              onPress={handleRemoveContentType}
              style={styles.removeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons
                name="close"
                size={16}
                color={isDarkMode ? '#FFFFFF' : '#666666'}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Tag Pills */}
        {selectedTags.map((tag) => (
          <View key={tag} style={[styles.pill, isDarkMode && styles.pillDark]}>
            <Text style={[styles.pillText, isDarkMode && styles.pillTextDark]}>
              {tag}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveTag(tag)}
              style={styles.removeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons
                name="close"
                size={16}
                color={isDarkMode ? '#FFFFFF' : '#666666'}
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
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 8,
  },
  containerDark: {
    backgroundColor: '#000000',
    borderBottomColor: '#38383A',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  pillDark: {
    backgroundColor: '#2C2C2E',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  pillTextDark: {
    color: '#FFFFFF',
  },
  removeButton: {
    padding: 2,
  },
});
