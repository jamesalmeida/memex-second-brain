import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { itemsStore } from '../stores/items';

interface TagsManagerModalProps {
  visible: boolean;
  initialTags: string[];
  onDone: (tags: string[]) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const TagsManagerModal = observer(({
  visible,
  initialTags,
  onDone,
  onCancel,
  isSubmitting = false,
}: TagsManagerModalProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const allItems = itemsStore.items.get();

  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [query, setQuery] = useState('');
  const [recentExpanded, setRecentExpanded] = useState(true);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setSelectedTags(initialTags);
      setQuery('');
      setRecentExpanded(true);
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimer);
    }
  }, [visible, initialTags]);

  const allTags = useMemo(() => {
    const unique = new Map<string, string>();
    allItems.forEach((item) => {
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
  }, [allItems]);

  const recentTags = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const itemsByRecency = [...allItems].sort((a, b) => {
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
  }, [allItems]);

  const normalizedSelectedKeys = useMemo(
    () => selectedTags.map(tag => tag.toLowerCase()),
    [selectedTags],
  );

  const filteredSuggestions = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return [];

    const suggestions = allTags.filter(tag => {
      const key = tag.toLowerCase();
      if (normalizedSelectedKeys.includes(key)) return false;
      return key.includes(trimmedQuery);
    });

    return suggestions.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(trimmedQuery);
      const bStarts = bLower.startsWith(trimmedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
  }, [allTags, normalizedSelectedKeys, query]);

  const canCreateNewTag = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (normalizedSelectedKeys.includes(lower)) return false;
    return !allTags.some(tag => tag.toLowerCase() === lower);
  }, [allTags, normalizedSelectedKeys, query]);

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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    try {
      await Promise.resolve(onDone(selectedTags));
    } catch (error) {
      console.error('Error applying tags:', error);
    }
  };

  const visibleRecent = useMemo(
    () => recentTags.filter(tag => !normalizedSelectedKeys.includes(tag.toLowerCase())),
    [normalizedSelectedKeys, recentTags],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onCancel}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={[styles.modalContent, isDarkMode && styles.modalContentDark]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                Add Tags
              </Text>
              <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={isDarkMode ? '#FFFFFF' : '#3A3A3C'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputRow, isDarkMode && styles.inputRowDark]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="Start typing tags..."
                placeholderTextColor={isDarkMode ? '#8E8E93' : '#A0A4B0'}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (query.trim()) {
                    handleAddTag(query.trim());
                  }
                }}
              />
              <TouchableOpacity
                style={styles.caretButton}
                onPress={() => setRecentExpanded(prev => !prev)}
              >
                <MaterialIcons
                  name={recentExpanded ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={isDarkMode ? '#FFFFFF' : '#3A3A3C'}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.listContainer, isDarkMode && styles.listContainerDark]}>
              {query.trim() ? (
                <ScrollView keyboardShouldPersistTaps="handled">
                  {filteredSuggestions.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.listItem, isDarkMode && styles.listItemDark]}
                      onPress={() => handleAddTag(tag)}
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
                      onPress={() => handleAddTag(query)}
                    >
                      <MaterialIcons name="add" size={18} color="#FF6B35" style={styles.createIcon} />
                      <Text style={[styles.createText, isDarkMode && styles.createTextDark]}>
                        Add "{query.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              ) : (
                <>
                  {recentExpanded && visibleRecent.length > 0 ? (
                    <View>
                      <Text style={[styles.sectionLabel, isDarkMode && styles.sectionLabelDark]}>
                        Recent Tags
                      </Text>
                      {visibleRecent.map(tag => (
                        <TouchableOpacity
                          key={tag}
                          style={[styles.listItem, isDarkMode && styles.listItemDark]}
                          onPress={() => handleAddTag(tag)}
                        >
                          <Text style={[styles.listItemText, isDarkMode && styles.listItemTextDark]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
                      {recentExpanded ? 'No recent tags yet' : 'Recent tags hidden'}
                    </Text>
                  )}
                </>
              )}
            </View>

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
              style={[styles.doneButton, isDarkMode && styles.doneButtonDark, isSubmitting && styles.doneButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.doneButtonText}>Done</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default TagsManagerModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 20,
  },
  backdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A3A3C',
    letterSpacing: 0.5,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTagsSection: {
    marginTop: 12,
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
    borderRadius: 16,
    backgroundColor: '#F6F7FB',
    borderWidth: 1,
    borderColor: '#E8EAF2',
    paddingHorizontal: 12,
    paddingVertical: 4,
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
    borderRadius: 18,
    backgroundColor: '#F6F7FB',
    borderWidth: 1,
    borderColor: '#E8EAF2',
    paddingVertical: 6,
    paddingHorizontal: 4,
    maxHeight: 220,
    marginBottom: 20,
  },
  listContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
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
