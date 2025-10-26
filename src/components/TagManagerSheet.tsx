import React, { forwardRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { itemsStore, itemsActions } from '../stores/items';
import { COLORS } from '../constants';

interface TagManagerSheetProps {
  onOpen?: () => void;
  onClose?: () => void;
}

const TagManagerSheet = observer(
  forwardRef<BottomSheet, TagManagerSheetProps>(({ onOpen, onClose }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const items = itemsStore.items.get();

    const [editingTag, setEditingTag] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    // Calculate all unique tags and their counts
    const tagStats = useMemo(() => {
      const tagMap = new Map<string, number>();
      items.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach(tag => {
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
          });
        }
      });
      // Convert to array and sort by usage count (descending)
      return Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    }, [items]);

    // Snap points for the bottom sheet
    const snapPoints = useMemo(() => ['75%'], []);

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

    const handleEditTag = (tag: string) => {
      setEditingTag(tag);
      setEditValue(tag);
    };

    const handleSaveEdit = async () => {
      if (!editingTag || !editValue.trim()) {
        setEditingTag(null);
        return;
      }

      const oldTag = editingTag;
      const newTag = editValue.trim();

      // If no change, just cancel
      if (oldTag === newTag) {
        setEditingTag(null);
        return;
      }

      // Check if new tag already exists (merge case)
      const newTagExists = tagStats.some(t => t.tag === newTag);

      if (newTagExists) {
        Alert.alert(
          'Merge Tags',
          `"${newTag}" already exists. This will merge all items tagged with "${oldTag}" into "${newTag}".`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Merge',
              onPress: async () => {
                await performTagUpdate(oldTag, newTag);
                setEditingTag(null);
              },
            },
          ]
        );
      } else {
        await performTagUpdate(oldTag, newTag);
        setEditingTag(null);
      }
    };

    const performTagUpdate = async (oldTag: string, newTag: string) => {
      try {
        // Find all items with the old tag
        const itemsToUpdate = items.filter(item =>
          item.tags && item.tags.includes(oldTag)
        );

        console.log(`🏷️ Updating ${itemsToUpdate.length} items from "${oldTag}" to "${newTag}"`);

        // Update each item
        for (const item of itemsToUpdate) {
          const updatedTags = item.tags!.map(tag => tag === oldTag ? newTag : tag);
          // Remove duplicates if merging
          const uniqueTags = Array.from(new Set(updatedTags));
          await itemsActions.updateItemWithSync(item.id, { tags: uniqueTags });
        }

        Alert.alert('Success', `Updated ${itemsToUpdate.length} item(s)`);
      } catch (error) {
        console.error('Error updating tags:', error);
        Alert.alert('Error', 'Failed to update tags. Please try again.');
      }
    };

    const handleDeleteTag = (tag: string) => {
      const tagInfo = tagStats.find(t => t.tag === tag);
      if (!tagInfo) return;

      Alert.alert(
        'Delete Tag',
        `Are you sure you want to delete "${tag}"? This will remove it from ${tagInfo.count} item(s).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Find all items with this tag
                const itemsToUpdate = items.filter(item =>
                  item.tags && item.tags.includes(tag)
                );

                console.log(`🗑️ Removing "${tag}" from ${itemsToUpdate.length} items`);

                // Update each item
                for (const item of itemsToUpdate) {
                  const updatedTags = item.tags!.filter(t => t !== tag);
                  await itemsActions.updateItemWithSync(item.id, { tags: updatedTags });
                }

                Alert.alert('Success', `Removed tag from ${itemsToUpdate.length} item(s)`);
              } catch (error) {
                console.error('Error deleting tag:', error);
                Alert.alert('Error', 'Failed to delete tag. Please try again.');
              }
            },
          },
        ]
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
        onChange={(index) => {
          if (index === -1) {
            onClose?.();
            setEditingTag(null);
          } else if (index >= 0) {
            onOpen?.();
          }
        }}
      >
        <View style={styles.header}>
          <MaterialIcons
            name="local-offer"
            size={24}
            color={isDarkMode ? '#FFFFFF' : '#000000'}
            style={{ marginRight: 10 }}
          />
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Manage Tags
          </Text>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {tagStats.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="label-off"
                size={48}
                color={isDarkMode ? '#666' : '#999'}
              />
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                No tags yet
              </Text>
              <Text style={[styles.emptySubtext, isDarkMode && styles.emptySubtextDark]}>
                Tags you create will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.tagsList}>
              {tagStats.map(({ tag, count }) => (
                <View
                  key={tag}
                  style={[
                    styles.tagRow,
                    isDarkMode && styles.tagRowDark,
                  ]}
                >
                  {editingTag === tag ? (
                    <View style={styles.editContainer}>
                      <TextInput
                        style={[
                          styles.editInput,
                          isDarkMode && styles.editInputDark,
                        ]}
                        value={editValue}
                        onChangeText={setEditValue}
                        autoFocus
                        selectTextOnFocus
                        onSubmitEditing={handleSaveEdit}
                        onBlur={handleSaveEdit}
                        returnKeyType="done"
                      />
                      <Text style={[styles.tagCount, isDarkMode && styles.tagCountDark]}>
                        {count}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.tagInfo}>
                        <MaterialIcons
                          name="label"
                          size={20}
                          color={COLORS.primary}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[styles.tagName, isDarkMode && styles.tagNameDark]}
                          numberOfLines={1}
                        >
                          {tag}
                        </Text>
                        <View style={[styles.countBadge, isDarkMode && styles.countBadgeDark]}>
                          <Text style={[styles.tagCount, isDarkMode && styles.tagCountDark]}>
                            {count}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tagActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEditTag(tag)}
                        >
                          <MaterialIcons
                            name="edit"
                            size={20}
                            color={isDarkMode ? '#FFFFFF' : '#000000'}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleDeleteTag(tag)}
                        >
                          <MaterialIcons
                            name="delete"
                            size={20}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  })
);

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
    flexDirection: 'row',
    alignItems: 'center',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  },
  emptySubtextDark: {
    color: '#666',
  },
  tagsList: {
    padding: 20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  tagRowDark: {
    backgroundColor: '#2C2C2E',
  },
  tagInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  tagName: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  tagNameDark: {
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: '#E5E5E7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  countBadgeDark: {
    backgroundColor: '#3C3C3E',
  },
  tagCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tagCountDark: {
    color: '#999',
  },
  tagActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editInputDark: {
    color: '#FFFFFF',
    backgroundColor: '#1C1C1E',
    borderColor: COLORS.primary,
  },
});

export default TagManagerSheet;
