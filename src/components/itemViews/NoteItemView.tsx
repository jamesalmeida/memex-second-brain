import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemsStore, itemsActions } from '../../stores/items';
import { spacesStore, spacesActions } from '../../stores/spaces';
import { Item, ContentType } from '../../types';
import TagsEditor from '../TagsEditor';
import InlineEditableText from '../InlineEditableText';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import * as Clipboard from 'expo-clipboard';
import { ImageWithActions } from '../ImageWithActions';
import ImageUploadModal, { ImageUploadModalHandle } from '../ImageUploadModal';
import SpaceSelectorModal from '../SpaceSelectorModal';

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
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(currentSpaceId || null);
  const imageUploadModalRef = useRef<ImageUploadModalHandle>(null);

  useEffect(() => {
    if (item) {
      // Get the latest item from store (in case it was updated)
      const latestItem = itemsStore.items.get().find(i => i.id === item.id) || item;

      setDisplayItem(latestItem);
      setSelectedSpaceId(latestItem.space_id || null);
      setTags(latestItem.tags || []);
    }
  }, [item]);

  // Watch items store for updates to the current item
  useEffect(() => {
    if (item?.id) {
      const latestItem = itemsStore.items.get().find(i => i.id === item.id);
      if (latestItem && latestItem.space_id !== selectedSpaceId) {
        console.log('📄 [ItemView] Item space_id changed in store, updating UI');
        setSelectedSpaceId(latestItem.space_id || null);
        setDisplayItem(latestItem);
      }
    }
  }, [item?.id, itemsStore.items.get()]);

  const itemToDisplay = displayItem || item;
  if (!itemToDisplay) return null;

  const saveTagsToDatabase = async (tagsToSave: string[]) => {
    await itemsActions.updateItemWithSync(itemToDisplay.id, { tags: tagsToSave });
  };

  const handleImageSelected = async (imageUrl: string, storagePath?: string) => {
    try {
      await itemsActions.updateItemImage(itemToDisplay.id, imageUrl, storagePath);
      setDisplayItem(prev => (prev ? { ...prev, thumbnail_url: imageUrl } : prev));
      Alert.alert('Success', 'Image updated successfully');
    } catch (error) {
      console.error('Error updating image:', error);
      Alert.alert('Error', 'Failed to update image');
    }
  };

  const handleImageRemove = async () => {
    try {
      await itemsActions.removeItemImage(itemToDisplay.id);
      setDisplayItem(prev => (prev ? { ...prev, thumbnail_url: null } : prev));
      Alert.alert('Success', 'Image removed successfully');
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
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

      {/* Hero Image */}
      <View style={styles.heroWrapper}>
        {itemToDisplay.thumbnail_url ? (
          <ImageWithActions
            source={{ uri: itemToDisplay.thumbnail_url }}
            imageUrl={itemToDisplay.thumbnail_url}
            style={styles.heroImage}
            contentFit="contain"
            canReplace
            canRemove
            onImageReplace={() => imageUploadModalRef.current?.open()}
            onImageRemove={handleImageRemove}
          />
        ) : (
          <TouchableOpacity
            style={[styles.placeholderHero, isDarkMode && styles.placeholderHeroDark]}
            onPress={() => imageUploadModalRef.current?.open()}
            activeOpacity={0.7}
          >
            <Text style={styles.placeholderIcon}>🖼️</Text>
            <Text style={[styles.placeholderText, isDarkMode && styles.placeholderTextDark]}>
              Tap to add image
            </Text>
          </TouchableOpacity>
        )}
      </View>

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

        {/* Space Selector */}
        <View style={styles.spaceSection}>
          <Text style={[styles.spaceSectionLabel, isDarkMode && styles.spaceSectionLabelDark]}>
            SPACES
          </Text>
          <TouchableOpacity
            style={[styles.spaceSelector, isDarkMode && styles.spaceSelectorDark]}
            onPress={() => setShowSpaceModal(true)}
            activeOpacity={0.7}
          >
            {selectedSpaceId ? (
              <View style={styles.selectedSpaces}>
                {(() => {
                  const allSpaces = spacesStore.spaces.get();
                  const space = allSpaces.find(s => s.id === selectedSpaceId);
                  return space ? (
                    <View key={selectedSpaceId} style={styles.selectedSpaceTag}>
                      <View
                        style={[
                          styles.spaceTagDot,
                          { backgroundColor: space.color }
                        ]}
                      />
                      <Text style={[styles.spaceTagText, isDarkMode && styles.spaceTagTextDark]}>
                        {space.name}
                      </Text>
                    </View>
                  ) : null;
                })()}
              </View>
            ) : (
              <Text style={[styles.noSpace, isDarkMode && styles.noSpaceDark]}>
                📂 Everything (No Space)
              </Text>
            )}
          </TouchableOpacity>
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

      <ImageUploadModal
        ref={imageUploadModalRef}
        onImageSelected={handleImageSelected}
      />

      {/* Space Selector Modal */}
      <SpaceSelectorModal
        visible={showSpaceModal}
        itemId={itemToDisplay?.id || ''}
        currentSpaceId={selectedSpaceId}
        onClose={() => setShowSpaceModal(false)}
        onSpaceChange={(spaceId) => setSelectedSpaceId(spaceId)}
      />
    </View>
  );
});

export default NoteItemView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroWrapper: {
    paddingHorizontal: CONTENT_PADDING,
    marginTop: 16,
    marginBottom: 12,
  },
  heroImage: {
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH * 0.6,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  placeholderHero: {
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH * 0.6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderHeroDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  placeholderIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  placeholderTextDark: {
    color: '#AAA',
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
  spaceSection: {
    marginBottom: 20,
  },
  spaceSectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spaceSectionLabelDark: {
    color: '#999',
  },
  spaceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  spaceSelectorDark: {
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
  spaceTagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  spaceTagText: {
    fontSize: 12,
    color: '#333',
  },
  spaceTagTextDark: {
    color: '#FFF',
  },
  noSpace: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  noSpaceDark: {
    color: '#666',
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
