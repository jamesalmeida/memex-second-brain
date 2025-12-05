import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Host } from '@expo/ui/swift-ui';
import { themeStore } from '../stores/theme';
import { filterStore, filterActions } from '../stores/filter';
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
  const searchQuery = filterStore.searchQuery?.get?.() || '';

  const [isSearching, setIsSearching] = useState(false);
  const [localSearchText, setLocalSearchText] = useState(searchQuery);
  const inputRef = useRef<TextInput>(null);
  const underlineOpacity = useRef(new Animated.Value(0)).current;
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;

  let title = 'Everything';
  let placeholder = 'Search Everything';

  if (showArchived) {
    title = 'Archive';
    placeholder = 'Search Archive';
  } else if (selectedSpaceId) {
    const spaces = spacesComputed.activeSpaces();
    const selectedSpace = spaces.find(s => s.id === selectedSpaceId);
    if (selectedSpace) {
      title = selectedSpace.name;
      placeholder = `Search ${selectedSpace.name}`;
    }
  }

  const textColor = isDarkMode ? '#FFFFFF' : '#000000';
  const placeholderColor = isDarkMode ? '#666666' : '#CCCCCC';

  // Sync local state with store when not focused
  useEffect(() => {
    if (!isSearching) {
      setLocalSearchText(searchQuery);
    }
  }, [searchQuery, isSearching]);

  // Animate underline and clear button
  useEffect(() => {
    Animated.timing(underlineOpacity, {
      toValue: isSearching ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isSearching]);

  useEffect(() => {
    Animated.timing(clearButtonOpacity, {
      toValue: isSearching ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isSearching]);

  const handleTitlePress = () => {
    setIsSearching(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSearchChange = (text: string) => {
    setLocalSearchText(text);
    filterActions.setSearchQuery(text);
  };

  const handleClearPress = () => {
    if (localSearchText.length > 0) {
      // First press: clear text but keep focus
      setLocalSearchText('');
      filterActions.clearSearchQuery();
    } else {
      // Second press on empty input: lose focus
      setIsSearching(false);
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    setIsSearching(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDarkMode && styles.containerDark]}>
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          {!isSearching ? (
            <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
              <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.searchContainer}>
              <TextInput
                ref={inputRef}
                style={[styles.searchInput, { color: textColor }]}
                value={localSearchText}
                onChangeText={handleSearchChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              <Animated.View
                style={[
                  styles.underline,
                  {
                    backgroundColor: textColor,
                    opacity: underlineOpacity,
                  },
                ]}
              />
            </View>
          )}
        </View>

        <View style={styles.rightButtons}>
          {isSearching && (
            <Animated.View style={{ opacity: clearButtonOpacity }}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearPress}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color={textColor} />
              </TouchableOpacity>
            </Animated.View>
          )}

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
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: {
    position: 'relative',
  },
  searchInput: {
    fontSize: 28,
    fontWeight: 'bold',
    paddingVertical: 0,
    paddingBottom: 4,
    minWidth: 200,
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
  },
});
