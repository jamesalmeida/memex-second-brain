import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
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

const LIST_MAX_HEIGHT = 240;

interface ItemTagsSheetProps {
  onOpen?: () => void;
  onClose?: () => void;
  onDone?: (tags: string[]) => void | Promise<void>;
  /**
   * Optional: If provided, only tags from these items will be shown.
   * Useful for filtering tags based on active content type filters.
   */
  filteredItems?: Item[];
}

const ItemTagsSheet = observer(
  forwardRef<BottomSheet, ItemTagsSheetProps>(({ onOpen, onClose, onDone, filteredItems }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const allItems = itemsStore.items.get();

    // Use filtered items if provided, otherwise use all items
    const itemsToUse = filteredItems || allItems;

    const [initialTags, setInitialTags] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [recentExpanded, setRecentExpanded] = useState(true);
    const [listContentHeight, setListContentHeight] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const listHeight = useSharedValue(0);
    const listOpacity = useSharedValue(0);
    const listTranslate = useSharedValue(-8);
    const caretValue = useSharedValue(1);

    // Snap points for the bottom sheet
    const snapPoints = useMemo(() => ['85%'], []);

    // Render backdrop
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    // Method to open the sheet with initial tags
    const openWithTags = useCallback((tags: string[]) => {
      setInitialTags(tags);
      setSelectedTags(tags);
      setQuery('');
      setRecentExpanded(true);
      setListContentHeight(0);
      listHeight.value = 0;
      listOpacity.value = 0;
      listTranslate.value = -8;
      caretValue.value = 1;

      // Focus input after a delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }, [caretValue, listHeight, listOpacity, listTranslate]);

    // Expose openWithTags method via ref
    React.useImperativeHandle(ref, () => ({
      ...(ref as any)?.current,
      openWithTags,
    }));

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
      setIsSubmitting(true);
      try {
        if (onDone) {
          await Promise.resolve(onDone(selectedTags));
        }
        (ref as any)?.current?.close();
      } catch (error) {
        console.error('Error applying tags:', error);
      } finally {
        setIsSubmitting(false);
      }
    }, [isSubmitting, onDone, selectedTags, ref]);

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
          <View
            style={styles.listContent}
            onLayout={forMeasurement ? (e) => handleListContentSizeChange(0, e.nativeEvent.layout.height) : undefined}
          >
            {filteredSuggestions.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[styles.listItem, isDarkMode && styles.listItemDark]}
                onPress={forMeasurement ? undefined : () => handleAddTag(tag)}
                activeOpacity={forMeasurement ? 1 : 0.8}
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
              >
                <MaterialIcons name="add" size={18} color="#FF6B35" style={styles.createIcon} />
                <Text style={[styles.createText, isDarkMode && styles.createTextDark]}>
                  Add "{trimmedQuery}"
                </Text>
              </TouchableOpacity>
            )}
          </View>
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

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        topInset={50}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={async (index) => {
          if (index === -1) {
            // Sheet is closing - save changes
            if (!isSubmitting && onDone && JSON.stringify(selectedTags) !== JSON.stringify(initialTags)) {
              setIsSubmitting(true);
              try {
                await Promise.resolve(onDone(selectedTags));
              } catch (error) {
                console.error('Error saving tags on close:', error);
              } finally {
                setIsSubmitting(false);
              }
            }
            onClose?.();
          } else if (index >= 0) {
            onOpen?.();
          }
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Add Tags
          </Text>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
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
                    <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={styles.selectedTagRemove}>
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

          <TouchableOpacity
            style={[
              styles.doneButton,
              isDarkMode && styles.doneButtonDark,
              isSubmitting && styles.doneButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.doneButtonText}>Done</Text>
            )}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  })
);

export default ItemTagsSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#CCCCCC',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#666666',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 120,
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
    marginTop: 12,
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
