import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking, Share, Dimensions, Platform, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import ImageUploadModal, { ImageUploadModalHandle } from '../ImageUploadModal';
import HeroMediaSection from '../HeroMediaSection';
import Animated, { FadeInDown, FadeOutUp, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { useToast } from '../../contexts/ToastContext';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { imageDescriptionsActions, imageDescriptionsComputed } from '../../stores/imageDescriptions';
import { aiSettingsComputed } from '../../stores/aiSettings';
import { itemsActions, itemsStore } from '../../stores/items';
import { Item, ImageDescription } from '../../types';
import { formatDate } from '../../utils/itemCardHelpers';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import TagsEditor from '../TagsEditor';
import InlineEditableText from '../InlineEditableText';
import { openai } from '../../services/openai';
import TldrSection from '../TldrSection';
import NotesSection from '../NotesSection';
import ItemViewFooter from '../ItemViewFooter';
import ContentTypeSelectorModal from '../ContentTypeSelectorModal';

const { width: screenWidth } = Dimensions.get('window');

interface MovieTVItemViewProps {
  item: Item;
  onChat?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onUnarchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  currentSpaceId?: string | null;
}

const MovieTVItemView = observer(({
  item,
  onChat,
  onArchive,
  onUnarchive,
  onDelete,
  onShare,
  currentSpaceId,
}: MovieTVItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const { showToast } = useToast();
  // Note: currentImageIndex and scrollViewRef now handled by HeroMediaSection
  const imageUploadModalRef = useRef<ImageUploadModalHandle>(null);
  const [isGeneratingImageDescriptions, setIsGeneratingImageDescriptions] = useState(false);
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(item.thumbnail_url || null);

  // Get video URL and image URLs from item type metadata
  const videoUrl = itemTypeMetadataComputed.getVideoUrl(item.id);
  const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);

  // Get image descriptions from store
  const imageDescriptions = imageDescriptionsComputed.getDescriptionsByItemId(item.id);
  const isGeneratingFromStore = imageDescriptionsComputed.isGenerating(item.id);

  // Set up video player if item has video
  const player = useVideoPlayer(videoUrl || null, player => {
    if (player && videoUrl) {
      player.loop = true;
      player.muted = true;
      player.volume = 0;
      player.play();
    }
  });

  const hasMultipleImages = imageUrls && imageUrls.length > 1;
  const itemToDisplay = item;
  const [tags, setTags] = useState<string[]>(itemToDisplay.tags || []);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);

  useEffect(() => {
    setTags(item.tags || []);
    setThumbnailUrl(item.thumbnail_url || null);
  }, [item.id, item.tags]);

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    if (itemToDisplay.url) {
      await Clipboard.setStringAsync(itemToDisplay.url);
      showToast({ message: 'URL copied to clipboard', type: 'success' });
    }
  };

  // Open URL in browser
  const handleOpenUrl = async () => {
    if (itemToDisplay.url) {
      const supported = await Linking.canOpenURL(itemToDisplay.url);
      if (supported) {
        await Linking.openURL(itemToDisplay.url);
      } else {
        Alert.alert('Error', `Cannot open URL: ${itemToDisplay.url}`);
      }
    }
  };

  // Share URL
  const handleShareUrl = async () => {
    if (itemToDisplay.url) {
      try {
        await Share.share({
          message: itemToDisplay.url,
          url: itemToDisplay.url,
        });
      } catch (error) {
        console.error('Error sharing URL:', error);
      }
    }
  };

  // Handle metadata refresh
  const handleRefreshMetadata = async () => {
    if (!itemToDisplay) return;

    setIsRefreshingMetadata(true);
    try {
      const success = await itemsActions.refreshMetadata(itemToDisplay.id);
      if (success) {
        showToast({ message: 'Metadata refreshed successfully', type: 'success' });
      } else {
        Alert.alert('Error', 'Failed to refresh metadata');
      }
    } catch (error) {
      console.error('Error refreshing metadata:', error);
      Alert.alert('Error', 'Failed to refresh metadata');
    } finally {
      setIsRefreshingMetadata(false);
    }
  };

  const handleHeroImageSelected = async (imageUrl: string, storagePath?: string) => {
    try {
      await itemsActions.updateItemImage(itemToDisplay.id, imageUrl, storagePath);
      setThumbnailUrl(imageUrl);
      showToast({ message: 'Image updated successfully', type: 'success' });
    } catch (error) {
      console.error('Error updating image:', error);
      Alert.alert('Error', 'Failed to update image');
    }
  };

  const handleHeroImageRemove = async () => {
    try {
      await itemsActions.removeItemImage(itemToDisplay.id);
      setThumbnailUrl(null);
      showToast({ message: 'Image removed successfully', type: 'success' });
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  const handleMetadataImageAdd = async (imageUrl: string, storagePath?: string) => {
    try {
      const { itemTypeMetadataActions } = await import('../../stores/itemTypeMetadata');
      await itemTypeMetadataActions.addImageUrl(itemToDisplay.id, imageUrl, itemToDisplay.content_type);
      showToast({ message: 'Image added successfully', type: 'success' });
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image');
    }
  };

  const handleMetadataImageRemove = async (imageUrl: string) => {
    try {
      const { itemTypeMetadataActions } = await import('../../stores/itemTypeMetadata');
      await itemTypeMetadataActions.removeImageUrl(itemToDisplay.id, imageUrl);
      showToast({ message: 'Image removed successfully', type: 'success' });
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  // Generate AI descriptions for all images
  const generateImageDescriptions = async () => {
    if (!itemToDisplay) return;

    const metadataImageUrls = itemTypeMetadataComputed.getImageUrls(itemToDisplay.id) || [];
    const urlsToDescribe = Array.from(
      new Set([
        ...metadataImageUrls.filter(Boolean),
        ...(thumbnailUrl ? [thumbnailUrl] : []),
      ])
    );

    if (urlsToDescribe.length === 0) {
      alert('No images found for this item.');
      return;
    }

    setIsGeneratingImageDescriptions(true);
    imageDescriptionsActions.setGenerating(itemToDisplay.id, true);

    try {
      console.log('🖼️  Generating descriptions for', urlsToDescribe.length, 'images');
      const selectedModel = aiSettingsComputed.selectedModel();
      const generatedDescriptions: ImageDescription[] = [];

      for (const imageUrl of urlsToDescribe) {
        // Generate description for each image
        const description = await openai.describeImage(imageUrl, {
          model: selectedModel.includes('gpt-4') ? selectedModel : 'gpt-4o-mini',
          maxTokens: 500,
        });

        const imageDescription: ImageDescription = {
          id: `${itemToDisplay.id}_${imageUrl}_${Date.now()}`,
          item_id: itemToDisplay.id,
          image_url: imageUrl,
          description,
          model: selectedModel.includes('gpt-4') ? selectedModel : 'gpt-4o-mini',
          fetched_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await imageDescriptionsActions.addDescription(imageDescription);
        generatedDescriptions.push(imageDescription);
      }

      console.log('✅ Generated', generatedDescriptions.length, 'descriptions');
      alert(`Generated ${generatedDescriptions.length} image descriptions!`);
    } catch (error) {
      console.error('❌ Error generating image descriptions:', error);
      alert('Failed to generate image descriptions. Please try again.');
    } finally {
      setIsGeneratingImageDescriptions(false);
      imageDescriptionsActions.setGenerating(itemToDisplay.id, false);
    }
  };

  // Generate tags using AI
  const handleGenerateTags = async () => {
    try {
      setGeneratingTags(true);
      const content = itemToDisplay.content || itemToDisplay.title || itemToDisplay.desc || '';

      // Create metadata object for the generateTags function
      const metadata: URLMetadata = {
        title: itemToDisplay.title,
        description: itemToDisplay.desc,
        contentType: itemToDisplay.content_type,
      };

      const generatedTags = await generateTags(content, metadata);

      // Update item with generated tags
      const currentTags = itemToDisplay.tags || [];
      const newTags = [...new Set([...currentTags, ...generatedTags])]; // Merge and deduplicate

      await itemsActions.updateItem(itemToDisplay.id, { tags: newTags });

      showToast({ message: `Generated ${generatedTags.length} new tags`, type: 'success' });
    } catch (error) {
      console.error('Error generating tags:', error);
      Alert.alert('Error', 'Failed to generate tags');
    } finally {
      setGeneratingTags(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Title (inline editable) */}
      <InlineEditableText
        value={itemToDisplay.title || ''}
        placeholder="Tap to add title"
        onSave={async (newTitle) => {
          await itemsActions.updateItem(itemToDisplay.id, { title: newTitle });
          // local immediate UI update is handled by global store subscription
        }}
        style={[styles.title, isDarkMode && styles.titleDark]}
        isDarkMode={isDarkMode}
      />

      {/* Media Section */}
      <View style={styles.mediaSection}>
        <HeroMediaSection
          item={itemToDisplay}
          isDarkMode={isDarkMode}
          contentTypeIcon="🎬"
          videoUrl={videoUrl}
          videoPlayer={player}
          onImageAdd={() => imageUploadModalRef.current?.open()}
          onImageRemove={handleMetadataImageRemove}
          onThumbnailRemove={handleHeroImageRemove}
        />

        {/* Image Actions - Generate Poster Description */}
        {(imageUrls || thumbnailUrl) && (
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={[styles.imageActionButton, isDarkMode && styles.imageActionButtonDark]}
              onPress={generateImageDescriptions}
              disabled={isGeneratingImageDescriptions || isGeneratingFromStore}
            >
              {isGeneratingImageDescriptions || isGeneratingFromStore ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
              ) : (
                <Text style={[styles.imageActionText, isDarkMode && styles.imageActionTextDark]}>✨ Generate Poster Description</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Image Descriptions Section */}
      {imageDescriptions && imageDescriptions.length > 0 && (
        <View style={styles.descriptionsSection}>
          <TouchableOpacity
            style={styles.descriptionHeader}
            onPress={() => setShowDescriptions(!showDescriptions)}
          >
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Image Descriptions ({imageDescriptions.length})
            </Text>
            <Text style={[styles.expandIcon, isDarkMode && styles.expandIconDark]}>
              {showDescriptions ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>

          {showDescriptions && (
            <Animated.View entering={FadeInDown} exiting={FadeOutUp}>
              {imageDescriptions.map((desc, index) => (
                <View key={desc.image_url} style={[styles.descriptionItem, isDarkMode && styles.descriptionItemDark]}>
                  <Text style={[styles.descriptionLabel, isDarkMode && styles.descriptionLabelDark]}>
                    {(() => {
                      if (imageUrls && imageUrls.includes(desc.image_url)) {
                        return `Image ${imageUrls.indexOf(desc.image_url) + 1}:`;
                      }
                      return `Image ${index + 1}:`;
                    })()}
                  </Text>
                  <Text style={[styles.descriptionText, isDarkMode && styles.descriptionTextDark]}>
                    {desc.description}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      )}

      {/* Description */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Description</Text>
        <InlineEditableText
          value={itemToDisplay.desc || ''}
          placeholder="Tap to add description"
          onSave={async (newDesc) => {
            await itemsActions.updateItem(itemToDisplay.id, { desc: newDesc });
          }}
          style={[styles.description, isDarkMode && styles.descriptionDark]}
          multiline
          maxLines={8}
          isDarkMode={isDarkMode}
        />
      </View>

      {/* Content */}
      {/* {itemToDisplay.content && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Content</Text>
          <Text style={[styles.content, isDarkMode && styles.contentDark]}>
            {itemToDisplay.content}
          </Text>
        </View>
      )} */}

      {/* TLDR Section */}
      <TldrSection
        item={itemToDisplay}
        isDarkMode={isDarkMode}
      />

      {/* Tags Section */}
      <View style={styles.section}>
        <View style={styles.tagsHeader}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Tags</Text>
        </View>
        <TagsEditor
          tags={tags}
          onChangeTags={async (newTags) => {
            setTags(newTags);
            await itemsActions.updateItem(itemToDisplay.id, { tags: newTags });
          }}
          generateTags={async () => {
            const content = itemToDisplay.content || itemToDisplay.title || itemToDisplay.desc || '';
            const metadata: URLMetadata = {
              title: itemToDisplay.title,
              description: itemToDisplay.desc,
              contentType: itemToDisplay.content_type,
            };
            const generated = await generateTags(content, metadata);
            return generated || [];
          }}
          buttonLabel="✨ Generate Tags"
        />
      </View>

      {/* Notes Section */}
      <NotesSection
        item={itemToDisplay}
        isDarkMode={isDarkMode}
      />

      {/* Spaces Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Space</Text>
        <Text style={[styles.spaceText, isDarkMode && styles.spaceTextDark]}>
          {currentSpaceId || 'No space assigned'}
        </Text>
      </View>

      {/* URL Section */}
      {itemToDisplay.url && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>URL</Text>
          <TouchableOpacity
            style={[styles.urlContainer, isDarkMode && styles.urlContainerDark]}
            onPress={handleOpenUrl}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.urlText, isDarkMode && styles.urlTextDark]}
              numberOfLines={2}
              ellipsizeMode="middle"
            >
              {itemToDisplay.url}
            </Text>
            <MaterialIcons
              name="open-in-new"
              size={20}
              color={isDarkMode ? '#5AC8FA' : '#007AFF'}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Content Type Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Content Type</Text>
        <TouchableOpacity
          style={[styles.typeSelector, isDarkMode && styles.typeSelectorDark]}
          onPress={() => setShowTypeModal(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.contentType, isDarkMode && styles.contentTypeDark]}>
            {itemToDisplay.content_type}
          </Text>
          <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Action */}
      {onChat && (
        <TouchableOpacity
          style={[styles.chatButton, isDarkMode && styles.chatButtonDark]}
          onPress={() => onChat(itemToDisplay)}
          activeOpacity={0.7}
        >
          <Text style={styles.chatButtonText}>💬 Chat</Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <ItemViewFooter
        item={itemToDisplay}
        onRefresh={handleRefreshMetadata}
        onShare={() => onShare?.(itemToDisplay)}
        onArchive={() => onArchive?.(itemToDisplay)}
        onUnarchive={() => onUnarchive?.(itemToDisplay)}
        onDelete={() => onDelete?.(itemToDisplay)}
        isRefreshing={isRefreshingMetadata}
        isDarkMode={isDarkMode}
      />

      <ImageUploadModal
        ref={imageUploadModalRef}
        onImageSelected={handleMetadataImageAdd}
      />

      {/* Content Type Selector Modal */}
      <ContentTypeSelectorModal
        visible={showTypeModal}
        itemId={itemToDisplay.id}
        currentType={itemToDisplay.content_type}
        onClose={() => setShowTypeModal(false)}
        onTypeChange={() => {
          // Modal handles the update, just close
        }}
      />
    </View>
  );
});

export default MovieTVItemView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    lineHeight: 28,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  mediaSection: {
    marginBottom: 20,
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    marginBottom: 20,
    borderRadius: 0,
    borderWidth: 4,
    borderColor: '#C0C0C0',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonIcon: {
    fontSize: 20,
    marginLeft: 3,
    color: '#FFFFFF',
  },
  carouselContainer: {
    position: 'relative',
    borderRadius: 0,
    borderWidth: 4,
    borderColor: '#C0C0C0',
    overflow: 'hidden',
  },
  carouselImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F0F0F0',
  },
  singleImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F0F0F0',
  },
  placeholderHero: {
    width: '100%',
    height: 300,
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
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  imageActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  imageActionButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  imageActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  imageActionTextDark: {
    color: '#FFFFFF',
  },
  descriptionsSection: {
    marginBottom: 20,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expandIcon: {
    fontSize: 12,
    color: '#666666',
  },
  expandIconDark: {
    color: '#999999',
  },
  descriptionItem: {
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  descriptionItemDark: {
    backgroundColor: '#2C2C2E',
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  descriptionLabelDark: {
    color: '#999999',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
  },
  descriptionTextDark: {
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
  },
  descriptionDark: {
    color: '#CCCCCC',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
  },
  contentDark: {
    color: '#CCCCCC',
  },
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Removed local tag UI styles in favor of shared TagsEditor styles
  spaceText: {
    fontSize: 15,
    color: '#333333',
  },
  spaceTextDark: {
    color: '#CCCCCC',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  urlContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  urlText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  urlTextDark: {
    color: '#5AC8FA',
  },
  urlActionIcon: {
    fontSize: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typeSelectorDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  contentType: {
    fontSize: 15,
    color: '#666666',
    textTransform: 'capitalize',
  },
  contentTypeDark: {
    color: '#999999',
  },
  chevron: {
    fontSize: 24,
    color: '#666666',
    fontWeight: '300',
  },
  chevronDark: {
    color: '#999999',
  },
  chatButton: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  chatButtonDark: {
    backgroundColor: '#0A84FF',
  },
  chatButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
