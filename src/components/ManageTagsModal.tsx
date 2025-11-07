import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { itemsStore, itemsActions } from '../stores/items';
import { BaseModal, ModalHeader } from './modals';

interface ManageTagsModalProps {
  visible: boolean;
  onClose: () => void;
}

const ManageTagsModal = observer(({ visible, onClose }: ManageTagsModalProps) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const allItems = itemsStore.items.get();
    const [editingTag, setEditingTag] = useState<string | null>(null);
    const [editedValue, setEditedValue] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatingTag, setUpdatingTag] = useState<string | null>(null);

    // Calculate tag statistics
    const tagStats = useMemo(() => {
      const counts: Record<string, number> = {};
      allItems.forEach(item => {
        if (!item.is_deleted && !item.is_archived) {
          item.tags?.forEach(tag => {
            const trimmed = tag?.trim();
            if (trimmed) {
              counts[trimmed] = (counts[trimmed] || 0) + 1;
            }
          });
        }
      });

      return Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tag, count]) => ({ tag, count }));
    }, [allItems]);

    // Handle editing a tag
    const handleEditTag = (tag: string) => {
      setEditingTag(tag);
      setEditedValue(tag);
    };

    const handleCancelEdit = () => {
      setEditingTag(null);
      setEditedValue('');
    };

    const handleSaveEdit = async (oldTag: string) => {
      const newTag = editedValue.trim();

      // Validation
      if (!newTag) {
        Alert.alert('Invalid Tag', 'Tag name cannot be empty.');
        return;
      }

      if (newTag === oldTag) {
        handleCancelEdit();
        return;
      }

      setIsUpdating(true);
      setUpdatingTag(oldTag);

      try {
        // Check if the new tag already exists
        const tagExists = tagStats.some(stat => stat.tag === newTag);

        if (tagExists) {
          // Merge: Replace oldTag with newTag in all items
          Alert.alert(
            'Merge Tags',
            `The tag "${newTag}" already exists. All items with "${oldTag}" will be updated to use "${newTag}". Continue?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setIsUpdating(false);
                  setUpdatingTag(null);
                }
              },
              {
                text: 'Merge',
                onPress: async () => {
                  await mergeTag(oldTag, newTag);
                  handleCancelEdit();
                  setIsUpdating(false);
                  setUpdatingTag(null);
                },
              },
            ],
            { cancelable: false }
          );
        } else {
          // Simple rename: Just replace oldTag with newTag
          await renameTag(oldTag, newTag);
          handleCancelEdit();
          setIsUpdating(false);
          setUpdatingTag(null);
        }
      } catch (error) {
        console.error('Error saving tag edit:', error);
        Alert.alert('Error', 'Failed to update tag. Please try again.');
        setIsUpdating(false);
        setUpdatingTag(null);
      }
    };

    // Rename a tag (no merge needed)
    const renameTag = async (oldTag: string, newTag: string) => {
      const itemsToUpdate = allItems.filter(
        item => item.tags?.includes(oldTag) && !item.is_deleted
      );

      for (const item of itemsToUpdate) {
        const updatedTags = item.tags?.map(tag => (tag === oldTag ? newTag : tag)) || [];
        await itemsActions.updateItemWithSync(item.id, { tags: updatedTags });
      }

      console.log(`✅ Renamed tag "${oldTag}" to "${newTag}" for ${itemsToUpdate.length} items`);
    };

    // Merge two tags (when new tag already exists)
    const mergeTag = async (oldTag: string, newTag: string) => {
      const itemsToUpdate = allItems.filter(
        item => item.tags?.includes(oldTag) && !item.is_deleted
      );

      for (const item of itemsToUpdate) {
        // Replace oldTag with newTag, and remove duplicates
        const updatedTags = Array.from(
          new Set(item.tags?.map(tag => (tag === oldTag ? newTag : tag)) || [])
        );
        await itemsActions.updateItemWithSync(item.id, { tags: updatedTags });
      }

      console.log(`✅ Merged tag "${oldTag}" into "${newTag}" for ${itemsToUpdate.length} items`);
    };

    // Handle deleting a tag
    const handleDeleteTag = (tag: string) => {
      Alert.alert(
        'Delete Tag',
        `Are you sure you want to remove the tag "${tag}" from all items?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setIsUpdating(true);
              setUpdatingTag(tag);
              try {
                await deleteTag(tag);
              } catch (error) {
                console.error('Error deleting tag:', error);
                Alert.alert('Error', 'Failed to delete tag. Please try again.');
              } finally {
                setIsUpdating(false);
                setUpdatingTag(null);
              }
            },
          },
        ],
        { cancelable: false }
      );
    };

    const deleteTag = async (tagToDelete: string) => {
      const itemsToUpdate = allItems.filter(
        item => item.tags?.includes(tagToDelete) && !item.is_deleted
      );

      for (const item of itemsToUpdate) {
        const updatedTags = item.tags?.filter(tag => tag !== tagToDelete) || [];
        await itemsActions.updateItemWithSync(item.id, { tags: updatedTags });
      }

      console.log(`✅ Deleted tag "${tagToDelete}" from ${itemsToUpdate.length} items`);
    };

    const handleClose = useCallback(() => {
      handleCancelEdit();
      onClose();
    }, [onClose]);

    return (
      <BaseModal visible={visible} onClose={handleClose}>
        <ModalHeader
          title="Manage Tags"
          subtitle={`${tagStats.length} ${tagStats.length === 1 ? 'tag' : 'tags'}`}
          onClose={handleClose}
          isDarkMode={isDarkMode}
        />

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isUpdating && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
                Updating tags...
              </Text>
            </View>
          )}

          {tagStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons
                name="label-off"
                size={48}
                color={isDarkMode ? '#666' : '#CCC'}
              />
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                No tags yet
              </Text>
              <Text style={[styles.emptySubtext, isDarkMode && styles.emptySubtextDark]}>
                Add tags to your items to organize them
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              {tagStats.map(({ tag, count }) => {
                const isThisTagUpdating = updatingTag === tag;
                const isAnyTagUpdating = isUpdating;

                return (
                  <View
                    key={tag}
                    style={[
                      styles.tagRow,
                      isAnyTagUpdating && !isThisTagUpdating && styles.tagRowDisabled,
                    ]}
                  >
                    {editingTag === tag ? (
                      // Edit mode
                      <>
                        <MaterialIcons
                          name="label"
                          size={24}
                          color={isDarkMode ? '#FFFFFF' : '#333333'}
                        />
                        <TextInput
                          style={[
                            styles.tagInput,
                            isDarkMode && styles.tagInputDark,
                          ]}
                          value={editedValue}
                          onChangeText={setEditedValue}
                          autoFocus
                          selectTextOnFocus
                          returnKeyType="done"
                          onSubmitEditing={() => handleSaveEdit(tag)}
                          editable={!isAnyTagUpdating}
                        />
                        {isThisTagUpdating ? (
                          <View style={styles.iconButton}>
                            <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
                          </View>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.iconButton}
                              onPress={() => handleSaveEdit(tag)}
                              disabled={isAnyTagUpdating}
                            >
                              <MaterialIcons
                                name="check"
                                size={24}
                                color="#34C759"
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.iconButton}
                              onPress={handleCancelEdit}
                              disabled={isAnyTagUpdating}
                            >
                              <MaterialIcons
                                name="close"
                                size={24}
                                color={isDarkMode ? '#999' : '#666'}
                              />
                            </TouchableOpacity>
                          </>
                        )}
                      </>
                    ) : (
                      // View mode
                      <>
                        <MaterialIcons
                          name="label"
                          size={24}
                          color={isDarkMode ? '#FFFFFF' : '#333333'}
                        />
                        <View style={styles.tagContent}>
                          <Text style={[styles.tagName, isDarkMode && styles.tagNameDark]}>
                            {tag}
                          </Text>
                          <Text style={[styles.tagCount, isDarkMode && styles.tagCountDark]}>
                            {count} {count === 1 ? 'item' : 'items'}
                          </Text>
                        </View>
                        {isThisTagUpdating ? (
                          <View style={styles.iconButton}>
                            <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
                          </View>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.iconButton}
                              onPress={() => handleEditTag(tag)}
                              disabled={isAnyTagUpdating}
                            >
                              <MaterialIcons
                                name="edit"
                                size={20}
                                color={isAnyTagUpdating ? '#999' : (isDarkMode ? '#0A84FF' : '#007AFF')}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.iconButton}
                              onPress={() => handleDeleteTag(tag)}
                              disabled={isAnyTagUpdating}
                            >
                              <MaterialIcons
                                name="delete"
                                size={20}
                                color={isAnyTagUpdating ? '#999' : '#FF3B30'}
                              />
                            </TouchableOpacity>
                          </>
                        )}
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </BaseModal>
    );
});

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  section: {
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  tagRowDisabled: {
    opacity: 0.5,
  },
  tagContent: {
    flex: 1,
    marginLeft: 15,
  },
  tagName: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  tagNameDark: {
    color: '#FFFFFF',
  },
  tagCount: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  tagCountDark: {
    color: '#666666',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  tagInput: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#000000',
    padding: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  tagInputDark: {
    color: '#FFFFFF',
    backgroundColor: '#2C2C2E',
    borderColor: '#0A84FF',
  },
  loadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  loadingTextDark: {
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyTextDark: {
    color: '#999',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtextDark: {
    color: '#666',
  },
});

export default ManageTagsModal;
