import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemsStore, itemsActions } from '../../stores/items';
import { itemSpacesComputed, itemSpacesActions } from '../../stores/itemSpaces';
import { spacesStore, spacesActions } from '../../stores/spaces';
import { Item, ContentType } from '../../types';
import TagsEditor from '../TagsEditor';
import InlineEditableText from '../InlineEditableText';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - (CONTENT_PADDING * 2);

interface NoteItemViewProps {
  item: Item | null;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  currentSpaceId?: string | null;
}

const NoteItemView = observer(({ item, onChat, onEdit, onArchive, onDelete, onShare, currentSpaceId }: NoteItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [displayItem, setDisplayItem] = useState<Item | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>(currentSpaceId ? [currentSpaceId] : []);
  const allSpaces = spacesStore.spaces.get();
  const spaces = allSpaces;

  useEffect(() => {
    if (item) {
      setDisplayItem(item);
      const spaceIds = itemSpacesComputed.getSpaceIdsForItem(item.id);
      setSelectedSpaceIds(spaceIds);
      setTags(item.tags || []);
    }
  }, [item]);

  const itemToDisplay = displayItem || item;
  if (!itemToDisplay) return null;

  const saveTagsToDatabase = async (tagsToSave: string[]) => {
    await itemsActions.updateItemWithSync(itemToDisplay.id, { tags: tagsToSave });
  };

  const generateAITags = async () => {
    const content = itemToDisplay.content || itemToDisplay.desc || itemToDisplay.title || '';
    const metadata: URLMetadata = {
      url: itemToDisplay.url || '',
      title: itemToDisplay.title,
      description: itemToDisplay.desc || '',
      contentType: itemToDisplay.content_type,
    };
    const generated = await generateTags(content, metadata);
    const uniqueTags = generated.filter(tag => !tags.includes(tag));
    if (uniqueTags.length > 0) {
      const newTags = [...tags, ...uniqueTags];
      setTags(newTags);
      await saveTagsToDatabase(newTags);
    }
  };

  return (
    <View style={styles.container}>
      {/* Note Header */}
      {/* <View style={[styles.noteHeader, isDarkMode && styles.noteHeaderDark]}>
        <Text style={styles.noteEmoji}>📝</Text>
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]} numberOfLines={1}>
          Note
        </Text>
      </View> */}

      <View style={styles.content}>
        {/* Title (inline editable) */}
        <InlineEditableText
          value={itemToDisplay.title}
          placeholder="Tap to add title"
          onSave={async (newTitle) => {
            await itemsActions.updateItemWithSync(itemToDisplay.id, { title: newTitle });
            setDisplayItem({ ...(itemToDisplay as Item), title: newTitle });
          }}
          style={[styles.title, isDarkMode && styles.titleDark]}
          isDarkMode={isDarkMode}
        />

        {/* Body content */}
        {itemToDisplay.content && (
          <View style={[styles.noteBody, isDarkMode && styles.noteBodyDark]}> 
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.noteText, isDarkMode && styles.noteTextDark]}>
                {itemToDisplay.content}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={async () => {
                await Clipboard.setStringAsync(itemToDisplay.content || '');
                Alert.alert('Copied', 'Note copied to clipboard');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.copyIcon}>📋</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Description (inline editable) */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDarkMode && styles.sectionLabelDark]}>DESCRIPTION</Text>
          <InlineEditableText
            value={itemToDisplay.desc || ''}
            placeholder="Tap to add description"
            onSave={async (newDesc) => {
              await itemsActions.updateItemWithSync(itemToDisplay.id, { desc: newDesc });
            }}
            style={[styles.noteText, isDarkMode && styles.noteTextDark]}
            multiline
            maxLines={8}
            collapsible
            collapsedLines={6}
            showMoreThreshold={300}
            isDarkMode={isDarkMode}
          />
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDarkMode && styles.sectionLabelDark]}>TAGS</Text>
          <TagsEditor
            tags={tags}
            onChangeTags={async (newTags) => {
              setTags(newTags);
              await saveTagsToDatabase(newTags);
            }}
            generateTags={async () => {
              await generateAITags();
              return [] as string[];
            }}
            buttonLabel="✨ Generate Tags"
          />
        </View>

        {/* Spaces */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDarkMode && styles.sectionLabelDark]}>SPACES</Text>
          <TouchableOpacity
            style={[styles.selector, isDarkMode && styles.selectorDark]}
            onPress={() => setShowSpaceSelector(!showSpaceSelector)}
            activeOpacity={0.7}
          >
            {selectedSpaceIds.length > 0 ? (
              <View style={styles.selectedSpaces}>
                {selectedSpaceIds.slice(0, 3).map(spaceId => {
                  const space = spaces.find(s => s.id === spaceId);
                  return space ? (
                    <View key={spaceId} style={styles.selectedSpaceTag}>
                      <View style={[styles.spaceDot, { backgroundColor: space.color }]} />
                      <Text style={[styles.spaceText, isDarkMode && styles.spaceTextDark]}>
                        {space.name}
                      </Text>
                    </View>
                  ) : null;
                })}
                {selectedSpaceIds.length > 3 && (
                  <Text style={[styles.moreSpaces, isDarkMode && styles.moreSpacesDark]}>+{selectedSpaceIds.length - 3} more</Text>
                )}
              </View>
            ) : (
              <Text style={[styles.noSpace, isDarkMode && styles.noSpaceDark]}>No spaces assigned</Text>
            )}
            <Text style={styles.chevron}>{showSpaceSelector ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showSpaceSelector && (
            <View style={[styles.spaceOptions, isDarkMode && styles.spaceOptionsDark]}>
              {spaces.map((space) => (
                <TouchableOpacity
                  key={space.id}
                  style={styles.spaceOption}
                  onPress={async () => {
                    const newSelectedIds = selectedSpaceIds.includes(space.id)
                      ? selectedSpaceIds.filter(id => id !== space.id)
                      : [...selectedSpaceIds, space.id];
                    setSelectedSpaceIds(newSelectedIds);

                    const currentSpaceIds = itemSpacesComputed.getSpaceIdsForItem(itemToDisplay.id);

                    for (const spaceId of newSelectedIds) {
                      if (!currentSpaceIds.includes(spaceId)) {
                        await itemSpacesActions.addItemToSpace(itemToDisplay.id, spaceId);
                        const s = spaces.find(sp => sp.id === spaceId);
                        if (s) spacesActions.updateSpace(spaceId, { item_count: (s.item_count || 0) + 1 });
                      }
                    }

                    for (const spaceId of currentSpaceIds) {
                      if (!newSelectedIds.includes(spaceId)) {
                        await itemSpacesActions.removeItemFromSpace(itemToDisplay.id, spaceId);
                        const s = spaces.find(sp => sp.id === spaceId);
                        if (s) spacesActions.updateSpace(spaceId, { item_count: Math.max(0, (s.item_count || 0) - 1) });
                      }
                    }
                  }}
                >
                  <View style={styles.spaceOptionContent}>
                    <View style={[styles.checkbox, selectedSpaceIds.includes(space.id) && styles.checkboxSelected, selectedSpaceIds.includes(space.id) && { backgroundColor: space.color }]}>
                      {selectedSpaceIds.includes(space.id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <View style={[styles.spaceDot, { backgroundColor: space.color }]} />
                    <Text style={[styles.spaceOptionText, isDarkMode && styles.spaceOptionTextDark]}>
                      {space.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {selectedSpaceIds.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={async () => {
                    const currentSpaceIds = itemSpacesComputed.getSpaceIdsForItem(itemToDisplay.id);
                    for (const spaceId of currentSpaceIds) {
                      await itemSpacesActions.removeItemFromSpace(itemToDisplay.id, spaceId);
                      const s = spaces.find(sp => sp.id === spaceId);
                      if (s) spacesActions.updateSpace(spaceId, { item_count: Math.max(0, (s.item_count || 0) - 1) });
                    }
                    setSelectedSpaceIds([]);
                  }}
                >
                  <Text style={[styles.clearButtonText, isDarkMode && styles.clearButtonTextDark]}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction]}
            onPress={() => onChat?.(itemToDisplay)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonTextPrimary}>💬 Chat</Text>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => onEdit?.(itemToDisplay)} activeOpacity={0.7}>
              <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>✏️ Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => onShare?.(itemToDisplay)} activeOpacity={0.7}>
              <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>📤 Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => onArchive?.(itemToDisplay)} activeOpacity={0.7}>
              <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>📦 Archive</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => onDelete?.(itemToDisplay)} activeOpacity={0.7}>
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
});

export default NoteItemView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: 12,
    backgroundColor: '#FFFBEA',
  },
  noteHeaderDark: {
    backgroundColor: '#2A2A20',
  },
  noteEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  headerTitleDark: {
    color: '#FFF',
  },
  content: {
    padding: CONTENT_PADDING,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  noteBody: {
    position: 'relative',
    backgroundColor: '#FFFDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1E9C6',
    padding: 16,
    marginBottom: 16,
    maxHeight: 300,
  },
  noteBodyDark: {
    backgroundColor: '#2F2B1F',
    borderColor: '#3A3526',
  },
  noteText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2D2D2D',
  },
  noteTextDark: {
    color: '#E6E6E6',
  },
  copyButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyIcon: {
    fontSize: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelDark: {
    color: '#999',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectorDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3C3C3E',
  },
  selectedSpaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectedSpaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  spaceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  spaceText: {
    fontSize: 12,
    color: '#333',
  },
  spaceTextDark: {
    color: '#FFF',
  },
  moreSpaces: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  moreSpacesDark: {
    color: '#999',
  },
  noSpace: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  noSpaceDark: {
    color: '#666',
  },
  chevron: {
    fontSize: 12,
    color: '#666',
  },
  spaceOptions: {
    marginTop: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  spaceOptionsDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3C3C3E',
  },
  spaceOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  spaceOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: 'transparent',
  },
  checkmark: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
  },
  clearButtonTextDark: {
    color: '#FF6B6B',
  },
  actions: {
    marginTop: 20,
  },
  primaryAction: {
    backgroundColor: '#007AFF',
    marginBottom: 16,
  },
  actionButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionButtonTextDark: {
    color: '#FFF',
  },
  actionButtonTextPrimary: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryActions: {
    gap: 8,
  },
  deleteButton: {
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
  },
});


