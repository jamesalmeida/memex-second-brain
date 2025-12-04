import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Host } from '@expo/ui/swift-ui';
import { themeStore } from '../stores/theme';
import { filterStore } from '../stores/filter';
import { spacesComputed } from '../stores/spaces';
import { FilterContextMenuTrigger } from './FilterContextMenuTrigger';

interface SimpleHeaderProps {
  onFilterPress?: () => void;
}

const SimpleHeader = observer(({ onFilterPress }: SimpleHeaderProps) => {
  const insets = useSafeAreaInsets();
  const isDarkMode = themeStore.isDarkMode.get();

  // Determine the title based on current filter state
  const selectedSpaceId = filterStore.selectedSpaceId?.get?.() || null;
  const showArchived = filterStore.showArchived?.get?.() || false;

  let title = 'Everything';

  if (showArchived) {
    title = 'Archive';
  } else if (selectedSpaceId) {
    const spaces = spacesComputed.activeSpaces();
    const selectedSpace = spaces.find(s => s.id === selectedSpaceId);
    if (selectedSpace) {
      title = selectedSpace.name;
    }
  }

  const textColor = isDarkMode ? '#FFFFFF' : '#000000';

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDarkMode && styles.containerDark]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>

        <FilterContextMenuTrigger>
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.7}
            onPress={onFilterPress}
          >
            <MaterialIcons
              name="filter-list"
              size={26}
              color={textColor}
            />
          </TouchableOpacity>
        </FilterContextMenuTrigger>
      </View>
    </View>
  );
});

export default SimpleHeader;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingBottom: 12,
  },
  containerDark: {
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
  },
});
