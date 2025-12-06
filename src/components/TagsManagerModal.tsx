import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  View,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { itemsStore } from '../stores/items';
import { Item } from '../types';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BaseModal, ModalHeader } from './modals';

const LIST_MAX_HEIGHT = 240;

interface TagsManagerModalProps {
  visible: boolean;
  initialTags: string[];
  onDone: (tags: string[]) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  /**
   * Optional: If provided, only tags from these items will be shown.
   * Useful for filtering tags based on active content type filters.
   */
  filteredItems?: Item[];
}

const TagsManagerModal = observer(({
  visible,
  initialTags,
  onDone,
  onCancel,
  isSubmitting = false,
  filteredItems,
}: TagsManagerModalProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const allItems = itemsStore.items.get();

  // Use filtered items if provided, otherwise use all items
  const itemsToUse = filteredItems || allItems;

  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [query, setQuery] = useState('');
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [listContentHeight, setListContentHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const listHeight = useSharedValue(0);
  const listOpacity = useSharedValue(0);
  const listTranslate = useSharedValue(-8);
  const caretValue = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setSelectedTags(initialTags);
      setQuery('');
      setRecentExpanded(true);
      setListContentHeight(0);
      listHeight.value = 0;
      listOpacity.value = 0;
      listTranslate.value = -8;
      caretValue.value = 1;
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimer);
    }
  }, [visible, initialTags, caretValue, listHeight, listOpacity, listTranslate]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleShow = (event: KeyboardEvent) => {
      setKeyboardVisible(true);
      setKeyboardOffset(event.endCoordinates?.height ?? 0);
    };

    const handleHide = () => {
      setKeyboardVisible(false);
      setKeyboardOffset(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const allTags = useMemo(() => {
    const unique = new Map<string, string>();
    itemsToUse.forEach((item) => {
      item.tags?.forEach((tag) => {
        if (!tag) return;
        const trimmed = tag.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, trimmed);
        }
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [itemsToUse]);

  const recentTags = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const itemsByRecency = [...itemsToUse].sort((a, b) => {
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
    for (const item of itemsByRecency) {
      const itemTags = item.tags || [];
      for (const tag of itemTags) {
        const trimmed = tag?.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        ordered.push(trimmed);
        if (ordered.length >= 3) {
          return ordered;
        }
      }
    }
    return ordered;
  }, [itemsToUse]);

  const normalizedSelectedKeys = useMemo(
    () => selectedTags.map(tag => tag.toLowerCase()),
    [selectedTags],
  );

  const trimmedQuery = query.trim();

  const filteredSuggestions = useMemo(() => {
    const lower = trimmedQuery.toLowerCase();
    if (!lower) return [];

    const suggestions = allTags.filter(tag => {
      const key = tag.toLowerCase();
      if (normalizedSelectedKeys.includes(key)) return false;
      return key.includes(lower);
    });

    return suggestions.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(lower);
      const bStarts = bLower.startsWith(lower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
  }, [allTags, normalizedSelectedKeys, trimmedQuery]);

  const canCreateNewTag = useMemo(() => {
    if (!trimmedQuery) return false;
    const lower = trimmedQuery.toLowerCase();
    if (normalizedSelectedKeys.includes(lower)) return false;
    return !allTags.some(tag => tag.toLowerCase() === lower);
  }, [allTags, normalizedSelectedKeys, trimmedQuery]);

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (normalizedSelectedKeys.includes(lower)) {
      setQuery('');
      return;
    }
    setSelectedTags(prev => [...prev, trimmed]);
    setQuery('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleChangeQuery = (text: string) => {
    setQuery(text);
  };

  const handleToggleRecents = () => {
    setRecentExpanded(prev => !prev);
  };

  const handleListContentSizeChange = useCallback((_: number, height: number) => {
    const clamped = Math.min(height, LIST_MAX_HEIGHT);
    setListContentHeight(prev => (Math.abs(prev - clamped) > 1 ? clamped : prev));
  }, []);

  const handleRecentsLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    const clamped = Math.min(height, LIST_MAX_HEIGHT);
    setListContentHeight(prev => (Math.abs(prev - clamped) > 1 ? clamped : prev));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    try {
      await Promise.resolve(onDone(selectedTags));
    } catch (error) {
      console.error('Error applying tags:', error);
    }
  }, [isSubmitting, onDone, selectedTags]);

  const visibleRecent = useMemo(
    () => recentTags.filter(tag => !normalizedSelectedKeys.includes(tag.toLowerCase())),
    [normalizedSelectedKeys, recentTags],
  );

  const showSuggestions = trimmedQuery.length > 0;
  const showRecents = !showSuggestions && recentExpanded;
  const showListContainer = showSuggestions || showRecents;

  const animateList = useCallback((visibleList: boolean, height: number) => {
    const duration = visibleList ? 220 : 180;
    listHeight.value = withTiming(visibleList ? height : 0, { duration });
    listOpacity.value = withTiming(visibleList ? 1 : 0, { duration: visibleList ? 180 : 140 });
    listTranslate.value = withTiming(visibleList ? 0 : -8, { duration });
  }, [listHeight, listOpacity, listTranslate]);

  useEffect(() => {
    if (showListContainer) {
      if (listContentHeight > 0) {
        animateList(true, listContentHeight);
      }
    } else {
      animateList(false, 0);
    }
  }, [showListContainer, listContentHeight, animateList]);

  useEffect(() => {
    caretValue.value = withSpring(showRecents ? 1 : 0, {
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    });
  }, [showRecents, caretValue]);

  const listAnimatedStyle = useAnimatedStyle(() => ({
    height: listHeight.value,
    opacity: listOpacity.value,
    transform: [{ translateY: listTranslate.value }],
  }));

  const caretAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(caretValue.value, [0, 1], [0, 180]);
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  const renderListContent = (forMeasurement = false) => {
    if (!showListContainer) {
      return null;
    }

    if (showSuggestions) {
      return (
        <ScrollView
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.listContent}
          onContentSizeChange={forMeasurement ? handleListContentSizeChange : undefined}
          showsVerticalScrollIndicator={false}
        >
          {filteredSuggestions.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.listItem, isDarkMode && styles.listItemDark]}
              onPress={forMeasurement ? undefined : () => handleAddTag(tag)}
              activeOpacity={forMeasurement ? 1 : 0.8}
              focusable={false}
            >
              <Text style={[styles.listItemText, isDarkMode && styles.listItemTextDark]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}

          {filteredSuggestions.length === 0 && !canCreateNewTag && (
            <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
              No matching tags yet
            </Text>
          )}

          {canCreateNewTag && (
            <TouchableOpacity
              style={[styles.createItem, isDarkMode && styles.createItemDark]}
              onPress={forMeasurement ? undefined : () => handleAddTag(trimmedQuery)}
              activeOpacity={forMeasurement ? 1 : 0.8}
              focusable={false}
            >
              <MaterialIcons name="add" size={18} color="#FF6B35" style={styles.createIcon} />
              <Text style={[styles.createText, isDarkMode && styles.createTextDark]}>
                Add "{trimmedQuery}"
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      );
    }

    return (
      <View
        onLayout={forMeasurement ? handleRecentsLayout : undefined}
        style={styles.recentsContent}
      >
        <Text style={[styles.sectionLabel, isDarkMode && styles.sectionLabelDark]}>
          Recent Tags
        </Text>
        {visibleRecent.length > 0 ? (
          visibleRecent.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.listItem, isDarkMode && styles.listItemDark]}
              onPress={forMeasurement ? undefined : () => handleAddTag(tag)}
              activeOpacity={forMeasurement ? 1 : 0.8}
              focusable={false}
            >
              <Text style={[styles.listItemText, isDarkMode && styles.listItemTextDark]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            No recent tags yet
          </Text>
        )}
      </View>
    );
  };

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    onCancel();
  }, [onCancel]);

  return (
    <BaseModal visible={visible} onClose={handleCancel} keyboardAware={true}>
      <ModalHeader
        title="Add Tags"
        onClose={handleCancel}
        isDarkMode={isDarkMode}
      />

      <ScrollView
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
            <View
              style={[
                styles.inputRow,
                isDarkMode && styles.inputRowDark,
                showListContainer ? styles.inputRowConnected : styles.inputRowStandalone,
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="Start typing tags..."
                placeholderTextColor={isDarkMode ? '#8E8E93' : '#A0A4B0'}
                value={query}
                onChangeText={handleChangeQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  if (trimmedQuery) {
                    handleAddTag(trimmedQuery);
                  }
                }}
              />
              <TouchableOpacity
                style={styles.caretButton}
                onPress={handleToggleRecents}
                focusable={false}
              >
                <Animated.View style={caretAnimatedStyle}>
                  <MaterialIcons name="expand-more" size={22} color={isDarkMode ? '#FFFFFF' : '#3A3A3C'} />
                </Animated.View>
              </TouchableOpacity>
            </View>

            {showListContainer && (
              <View style={styles.measureContainer} pointerEvents="none">
                <View style={[styles.listContainer, isDarkMode && styles.listContainerDark]}>
                  {renderListContent(true)}
                </View>
              </View>
            )}

            <Animated.View
              style={[
                styles.listContainer,
                isDarkMode && styles.listContainerDark,
                listAnimatedStyle,
                { marginBottom: showListContainer ? 20 : 12 },
              ]}
              pointerEvents={showListContainer ? 'auto' : 'none'}
            >
              {showListContainer ? renderListContent(false) : null}
            </Animated.View>

            <View style={styles.selectedTagsSection}>
              {selectedTags.length > 0 ? (
                <View style={styles.selectedTagsContainer}>
                  {selectedTags.map(tag => (
                    <View
                      key={tag}
                      style={[styles.selectedTag, isDarkMode && styles.selectedTagDark]}
                    >
                      <Text style={[styles.selectedTagText, isDarkMode && styles.selectedTagTextDark]}>
                        {tag}
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={styles.selectedTagRemove} focusable={false}>
                        <MaterialIcons name="close" size={16} color={isDarkMode ? '#FFFFFF' : '#4A4A4A'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.selectedEmptyText, isDarkMode && styles.selectedEmptyTextDark]}>
                  Tags you add will appear here
                </Text>
              )}
            </View>

      <Pressable
        style={({ pressed }) => [
          styles.doneButton,
          isDarkMode && styles.doneButtonDark,
          (isSubmitting || pressed) && styles.doneButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        android_disableSound
        focusable={false}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.doneButtonText}>Done</Text>
        )}
      </Pressable>
      </ScrollView>
    </BaseModal>
  );
});

export default TagsManagerModal;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  measureContainer: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    left: 20,
    right: 20,
    zIndex: -1,
  },
  selectedTagsSection: {
    marginTop: 0,
    marginBottom: 20,
  },
  selectedTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedTagDark: {
    backgroundColor: '#2C2C2E',
  },
  selectedTagText: {
    fontSize: 14,
    color: '#2C2C2E',
  },
  selectedTagTextDark: {
    color: '#FFFFFF',
  },
  selectedTagRemove: {
    marginLeft: 6,
  },
  selectedEmptyText: {
    textAlign: 'center',
    color: '#8E8E93',
  },
  selectedEmptyTextDark: {
    color: '#A1A1A6',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
    borderWidth: 1,
    borderColor: '#E8EAF2',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  inputRowConnected: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  inputRowStandalone: {
    borderRadius: 16,
    marginBottom: 16,
  },
  inputRowDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F1F1F',
    paddingVertical: 8,
  },
  inputDark: {
    color: '#FFFFFF',
  },
  caretButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    backgroundColor: '#F6F7FB',
    borderWidth: 1,
    borderColor: '#E8EAF2',
    borderTopWidth: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  listContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
    borderTopWidth: 0,
  },
  listContent: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  recentsContent: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginHorizontal: 12,
    marginBottom: 6,
  },
  sectionLabelDark: {
    color: '#D1D1D6',
  },
  listItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  listItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  listItemText: {
    fontSize: 16,
    color: '#3A3A3C',
  },
  listItemTextDark: {
    color: '#FFFFFF',
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#8E8E93',
    paddingVertical: 16,
  },
  emptyStateTextDark: {
    color: '#A1A1A6',
  },
  createItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
  },
  createItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  createIcon: {
    marginRight: 8,
  },
  createText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },
  createTextDark: {
    color: '#FF7C4B',
  },
  doneButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonDark: {
    backgroundColor: '#FF7C4B',
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
