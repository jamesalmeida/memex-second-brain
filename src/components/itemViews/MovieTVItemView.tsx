import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking, Share, Dimensions, Platform, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ImageWithActions } from '../ImageWithActions';
import Animated, { FadeInDown, FadeOutUp, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { imageDescriptionsActions, imageDescriptionsComputed } from '../../stores/imageDescriptions';
import { aiSettingsComputed } from '../../stores/aiSettings';
import { itemsActions } from '../../stores/items';
import { Item, ImageDescription } from '../../types';
import { formatDate } from '../../utils/itemCardHelpers';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import TagsEditor from '../TagsEditor';
import InlineEditableText from '../InlineEditableText';
import { openai } from '../../services/openai';

const { width: screenWidth } = Dimensions.get('window');

interface MovieTVItemViewProps {
  item: Item;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  currentSpaceId?: string | null;
}

const MovieTVItemView = observer(({
  item,
  onChat,
  onEdit,
  onArchive,
  onDelete,
  onShare,
  currentSpaceId,
}: MovieTVItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isGeneratingImageDescriptions, setIsGeneratingImageDescriptions] = useState(false);
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);

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

  useEffect(() => {
    setTags(item.tags || []);
  }, [item.id, item.tags]);

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    if (itemToDisplay.url) {
      await Clipboard.setStringAsync(itemToDisplay.url);
      Alert.alert('Copied', 'URL copied to clipboard');
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

  // Generate AI descriptions for all images
  const generateImageDescriptions = async () => {
    if (!itemToDisplay) return;

    const imageUrls = itemTypeMetadataComputed.getImageUrls(itemToDisplay.id);
    if (!imageUrls || imageUrls.length === 0) {
      alert('No images found for this item.');
      return;
    }

    setIsGeneratingImageDescriptions(true);
    imageDescriptionsActions.setGenerating(itemToDisplay.id, true);

    try {
      console.log('🖼️  Generating descriptions for', imageUrls.length, 'images');
      const selectedModel = aiSettingsComputed.selectedModel();
      const generatedDescriptions: ImageDescription[] = [];

      for (const imageUrl of imageUrls) {
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

  // Download image to device
  const handleDownloadImage = async (imageUrl: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library permissions to download images');
        return;
      }

      const filename = imageUrl.split('/').pop() || 'image.jpg';
      const fileUri = FileSystem.documentDirectory + filename;

      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

      if (downloadResult.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('Memex', asset, false);
        Alert.alert('Success', 'Image saved to Photos');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      Alert.alert('Error', 'Failed to download image');
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

      Alert.alert('Success', `Generated ${generatedTags.length} new tags`);
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
      {videoUrl && player ? (
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            fullscreenOptions={{ enable: false }}
            showsTimecodes={false}
            muted={true}
          />
          <View style={styles.playButtonOverlay} pointerEvents="none">
            <View style={styles.playButton}>
              <Text style={styles.playButtonIcon}>▶</Text>
            </View>
          </View>
        </View>
      ) : hasMultipleImages ? (
        <View style={styles.mediaSection}>
          <View style={styles.carouselContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setCurrentImageIndex(newIndex);
              }}
              scrollEventThrottle={16}
            >
              {imageUrls!.map((imageUrl, index) => (
                <View key={index} style={{ width: screenWidth }}>
                  <ImageWithActions
                    source={{ uri: imageUrl }}
                    imageUrl={imageUrl}
                    style={styles.carouselImage}
                    contentFit="contain"
                  />
                </View>
              ))}
            </ScrollView>

            {/* Dots indicator */}
            <View style={styles.dotsContainer} pointerEvents="none">
              {imageUrls!.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentImageIndex && styles.activeDot
                  ]}
                />
              ))}
            </View>

            {/* Image Actions */}
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.imageActionButton, isDarkMode && styles.imageActionButtonDark]}
                onPress={generateImageDescriptions}
                disabled={isGeneratingImageDescriptions || isGeneratingFromStore}
              >
                {isGeneratingImageDescriptions || isGeneratingFromStore ? (
                  <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
                ) : (
                  <Text style={[styles.imageActionText, isDarkMode && styles.imageActionTextDark]}>✨ Describe</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageActionButton, isDarkMode && styles.imageActionButtonDark]}
                onPress={() => handleDownloadImage(imageUrls![currentImageIndex])}
              >
                <Text style={[styles.imageActionText, isDarkMode && styles.imageActionTextDark]}>⬇️ Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : imageUrls && imageUrls.length === 1 ? (
        <View style={styles.mediaSection}>
          <ImageWithActions
            source={{ uri: imageUrls[0] }}
            imageUrl={imageUrls[0]}
            style={styles.singleImage}
            contentFit="contain"
          />

          {/* Image Actions */}
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={[styles.imageActionButton, isDarkMode && styles.imageActionButtonDark]}
              onPress={generateImageDescriptions}
              disabled={isGeneratingImageDescriptions || isGeneratingFromStore}
            >
              {isGeneratingImageDescriptions || isGeneratingFromStore ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
              ) : (
                <Text style={[styles.imageActionText, isDarkMode && styles.imageActionTextDark]}>✨ Describe</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imageActionButton, isDarkMode && styles.imageActionButtonDark]}
              onPress={() => handleDownloadImage(imageUrls[0])}
            >
              <Text style={[styles.imageActionText, isDarkMode && styles.imageActionTextDark]}>⬇️ Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : itemToDisplay.thumbnail_url ? (
        <View style={styles.mediaSection}>
          <ImageWithActions
            source={{ uri: itemToDisplay.thumbnail_url }}
            imageUrl={itemToDisplay.thumbnail_url}
            style={styles.singleImage}
            contentFit="contain"
          />

          {/* Image Actions */}
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={[styles.imageActionButton, isDarkMode && styles.imageActionButtonDark]}
              onPress={generateImageDescriptions}
              disabled={isGeneratingImageDescriptions || isGeneratingFromStore}
            >
              {isGeneratingImageDescriptions || isGeneratingFromStore ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
              ) : (
                <Text style={[styles.imageActionText, isDarkMode && styles.imageActionTextDark]}>✨ Describe</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imageActionButton, isDarkMode && styles.imageActionButtonDark]}
              onPress={() => handleDownloadImage(itemToDisplay.thumbnail_url!)}
            >
              <Text style={[styles.imageActionText, isDarkMode && styles.imageActionTextDark]}>⬇️ Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

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
                    Image {imageUrls ? imageUrls.indexOf(desc.image_url) + 1 : index + 1}:
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
          <View style={styles.urlContainer}>
            <Text
              style={[styles.urlText, isDarkMode && styles.urlTextDark]}
              numberOfLines={2}
              ellipsizeMode="middle"
            >
              {itemToDisplay.url}
            </Text>
            <View style={styles.urlActions}>
              <TouchableOpacity
                style={[styles.urlActionButton, isDarkMode && styles.urlActionButtonDark]}
                onPress={handleCopyUrl}
              >
                <Text style={[styles.urlActionText, isDarkMode && styles.urlActionTextDark]}>📋 Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.urlActionButton, isDarkMode && styles.urlActionButtonDark]}
                onPress={handleOpenUrl}
              >
                <Text style={[styles.urlActionText, isDarkMode && styles.urlActionTextDark]}>🔗 Open</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.urlActionButton, isDarkMode && styles.urlActionButtonDark]}
                onPress={handleShareUrl}
              >
                <Text style={[styles.urlActionText, isDarkMode && styles.urlActionTextDark]}>📤 Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Content Type Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Content Type</Text>
        <Text style={[styles.contentType, isDarkMode && styles.contentTypeDark]}>
          {itemToDisplay.content_type}
        </Text>
      </View>

      {/* Metadata */}
      <View style={styles.metadata}>
        <Text style={[styles.metadataText, isDarkMode && styles.metadataTextDark]}>
          Created {formatDate(itemToDisplay.created_at)}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {onChat && (
          <TouchableOpacity
            style={[styles.actionButton, isDarkMode && styles.actionButtonDark]}
            onPress={() => onChat(itemToDisplay)}
          >
            <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>💬 Chat</Text>
          </TouchableOpacity>
        )}
        {onEdit && (
          <TouchableOpacity
            style={[styles.actionButton, isDarkMode && styles.actionButtonDark]}
            onPress={() => onEdit(itemToDisplay)}
          >
            <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>✏️ Edit</Text>
          </TouchableOpacity>
        )}
        {onArchive && (
          <TouchableOpacity
            style={[styles.actionButton, styles.archiveButton, isDarkMode && styles.archiveButtonDark]}
            onPress={() => onArchive(itemToDisplay)}
          >
            <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>📦 Archive</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => onDelete(itemToDisplay)}
          >
            <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
        )}
      </View>
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
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  urlText: {
    fontSize: 14,
    color: '#0066CC',
    marginBottom: 8,
  },
  urlTextDark: {
    color: '#4A9EFF',
  },
  urlActions: {
    flexDirection: 'row',
    gap: 8,
  },
  urlActionButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    alignItems: 'center',
  },
  urlActionButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  urlActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  urlActionTextDark: {
    color: '#FFFFFF',
  },
  contentType: {
    fontSize: 15,
    color: '#666666',
    textTransform: 'capitalize',
  },
  contentTypeDark: {
    color: '#999999',
  },
  metadata: {
    marginBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  metadataText: {
    fontSize: 13,
    color: '#999999',
  },
  metadataTextDark: {
    color: '#666666',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  actionButtonTextDark: {
    color: '#FFFFFF',
  },
  archiveButton: {
    backgroundColor: '#FFE5B4',
  },
  archiveButtonDark: {
    backgroundColor: '#4A3C2A',
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CC0000',
  },
});
