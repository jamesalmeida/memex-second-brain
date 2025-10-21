import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ImageWithActions } from '../ImageWithActions';
import ImageUploadModal, { ImageUploadModalHandle } from '../ImageUploadModal';
import { imageDescriptionsActions, imageDescriptionsComputed } from '../../stores/imageDescriptions';
import { ImageDescription } from '../../types';
import Animated, {
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { spacesStore, spacesActions } from '../../stores/spaces';
import { itemsStore, itemsActions } from '../../stores/items';
import { itemSpacesComputed, itemSpacesActions } from '../../stores/itemSpaces';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { aiSettingsComputed } from '../../stores/aiSettings';
import { Item, ContentType } from '../../types';
import { supabase } from '../../services/supabase';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import TagsEditor from '../TagsEditor';
import InlineEditableText from '../InlineEditableText';
import { openai } from '../../services/openai';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTENT_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - (CONTENT_PADDING * 2);

const contentTypeOptions: { type: ContentType; label: string; icon: string }[] = [
  { type: 'bookmark', label: 'Bookmark', icon: '🔖' },
  { type: 'note', label: 'Note', icon: '📝' },
  { type: 'youtube', label: 'YouTube', icon: '▶️' },
  { type: 'youtube_short', label: 'YT Short', icon: '🎬' },
  { type: 'x', label: 'X/Twitter', icon: '𝕏' },
  { type: 'instagram', label: 'Instagram', icon: '📷' },
  { type: 'tiktok', label: 'TikTok', icon: '🎵' },
  { type: 'reddit', label: 'Reddit', icon: '👽' },
  { type: 'movie', label: 'Movie', icon: '🎬' },
  { type: 'tv_show', label: 'TV Show', icon: '📺' },
  { type: 'github', label: 'GitHub', icon: '⚡' },
  { type: 'article', label: 'Article', icon: '📄' },
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'video', label: 'Video', icon: '🎥' },
  { type: 'audio', label: 'Audio', icon: '🎵' },
  { type: 'podcast', label: 'Podcast', icon: '🎙️' },
  { type: 'pdf', label: 'PDF', icon: '📑' },
  { type: 'product', label: 'Product', icon: '🛍️' },
];

interface RedditItemViewProps {
  item: Item | null;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  currentSpaceId?: string | null;
}

const RedditItemView = observer(({
  item,
  onChat,
  onEdit,
  onArchive,
  onDelete,
  onShare,
  currentSpaceId,
}: RedditItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>(currentSpaceId ? [currentSpaceId] : []);
  const allSpaces = spacesStore.spaces.get();
  const spaces = allSpaces;
  const [displayItem, setDisplayItem] = useState<Item | null>(null);

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState(item?.content_type || 'reddit');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const imageUploadModalRef = useRef<ImageUploadModalHandle>(null);
  const [expandedDescription, setExpandedDescription] = useState(false);

  // Image descriptions state
  const [imageDescriptions, setImageDescriptions] = useState<ImageDescription[]>([]);
  const [showImageDescriptions, setShowImageDescriptions] = useState(false);
  const [isGeneratingImageDescriptions, setIsGeneratingImageDescriptions] = useState(false);
  const [imageDescriptionsExist, setImageDescriptionsExist] = useState(false);
  const imageDescriptionsOpacity = useSharedValue(0);
  const imageDescriptionsButtonOpacity = useSharedValue(1);

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);

  useEffect(() => {
    console.log('📄 [RedditItemView] useEffect - item changed:', item?.title || 'null');
    if (item) {
      // Store the item for display
      setDisplayItem(item);
      setSelectedType(item.content_type);
      // Initialize selected spaces from item_spaces relationships
      const spaceIds = itemSpacesComputed.getSpaceIdsForItem(item.id);
      setSelectedSpaceIds(spaceIds);

      // Reset carousel index when opening a new item
      setCurrentImageIndex(0);

      // Initialize tags
      setTags(item.tags || []);
      setShowAllTags(false); // Reset to collapsed state when opening a new item

      // Check for existing image descriptions if item has images
      const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);
      if (imageUrls && imageUrls.length > 0) {
        checkForExistingImageDescriptions(item.id);
      }
    }
  }, [item]);

  // Watch for changes in image descriptions store to update UI state
  useEffect(() => {
    if (itemToDisplay) {
      // Access the observable to establish reactivity
      const descriptions = imageDescriptionsComputed.getDescriptionsByItemId(itemToDisplay.id);

      if (descriptions && descriptions.length > 0) {
        console.log('📄 [RedditItemView] Image descriptions detected in store:', descriptions.length);
        setImageDescriptions(descriptions);
        setImageDescriptionsExist(true);

        // Animate transition from button to dropdown
        imageDescriptionsButtonOpacity.value = withTiming(0, { duration: 150 }, () => {
          imageDescriptionsOpacity.value = withTiming(1, { duration: 150 });
        });
      } else {
        // Reset to button state if descriptions were removed
        setImageDescriptions([]);
        setImageDescriptionsExist(false);
        imageDescriptionsOpacity.value = 0;
        imageDescriptionsButtonOpacity.value = 1;
      }
    }
  }, [itemToDisplay?.id, imageDescriptionsComputed.descriptions()]);

  // Use displayItem for rendering
  const itemToDisplay = displayItem || item;
  if (!itemToDisplay) {
    return null;
  }

  const handleHeroImageSelected = async (imageUrl: string, storagePath?: string) => {
    if (!itemToDisplay) return;

    try {
      await itemsActions.updateItemImage(itemToDisplay.id, imageUrl, storagePath);
      setDisplayItem(prev => (prev ? { ...prev, thumbnail_url: imageUrl } : prev));
      Alert.alert('Success', 'Image updated successfully');
    } catch (error) {
      console.error('Error updating image:', error);
      Alert.alert('Error', 'Failed to update image');
    }
  };

  const handleHeroImageRemove = async () => {
    if (!itemToDisplay) return;

    try {
      await itemsActions.removeItemImage(itemToDisplay.id);
      setDisplayItem(prev => (prev ? { ...prev, thumbnail_url: null } : prev));
      Alert.alert('Success', 'Image removed successfully');
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  // Get Reddit metadata from ItemTypeMetadata
  const typeMetadata = itemTypeMetadataComputed.getTypeMetadataForItem(itemToDisplay.id);
  const redditMetadata = typeMetadata?.data?.reddit_metadata;

  // Extract subreddit from desc field (format: "r/subreddit: description" or just "r/subreddit")
  const subreddit = itemToDisplay.desc?.startsWith('r/')
    ? itemToDisplay.desc.split(':')[0]
    : null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  // Image description helper functions
  const checkForExistingImageDescriptions = async (itemId: string) => {
    try {
      console.log('Checking for existing image descriptions for item:', itemId);

      // Check local store for descriptions
      const existingDescriptions = imageDescriptionsComputed.getDescriptionsByItemId(itemId);

      if (existingDescriptions && existingDescriptions.length > 0) {
        console.log('Found', existingDescriptions.length, 'image descriptions in local store');
        setImageDescriptions(existingDescriptions);
        setImageDescriptionsExist(true);
        imageDescriptionsOpacity.value = 1;
        imageDescriptionsButtonOpacity.value = 0;
        return;
      }

      // No descriptions found
      console.log('No existing image descriptions found for item:', itemId);
      setImageDescriptions([]);
      setImageDescriptionsExist(false);
      imageDescriptionsOpacity.value = 0;
      imageDescriptionsButtonOpacity.value = 1;
    } catch (error) {
      console.error('Error checking for image descriptions:', error);
      // Set default state on error
      setImageDescriptions([]);
      setImageDescriptionsExist(false);
      imageDescriptionsOpacity.value = 0;
      imageDescriptionsButtonOpacity.value = 1;
    }
  };

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
        });

        if (description) {
          // Create and save the description
          const imageDescription: ImageDescription = {
            id: `${itemToDisplay.id}-${imageUrl}`,
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
      }

      // Update local state
      setImageDescriptions(generatedDescriptions);
      setImageDescriptionsExist(true);

      // Animate transition from button to dropdown
      imageDescriptionsButtonOpacity.value = withTiming(0, { duration: 150 }, () => {
        imageDescriptionsOpacity.value = withTiming(1, { duration: 150 });
      });

      // Auto-expand dropdown after generation
      setTimeout(() => {
        setShowImageDescriptions(true);
      }, 300);

    } catch (error) {
      console.error('Error generating image descriptions:', error);
      alert('Failed to generate image descriptions. Please try again.');
    } finally {
      setIsGeneratingImageDescriptions(false);
      imageDescriptionsActions.setGenerating(itemToDisplay.id, false);
    }
  };

  const copyImageDescriptionsToClipboard = async () => {
    if (imageDescriptions.length > 0) {
      const text = imageDescriptions.map((desc, idx) =>
        `Image ${idx + 1}:\n${desc.description}`
      ).join('\n\n');
      await Clipboard.setStringAsync(text);
    }
  };

  const getDomain = () => {
    if (!itemToDisplay?.url) return null;
    try {
      const url = new URL(itemToDisplay.url);
      return url.hostname.replace('www.', '');
    } catch {
      return null;
    }
  };

  // Tag management functions
  const addTag = async () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const newTags = [...tags, trimmedTag];
      setTags(newTags);
      setTagInput('');

      // Auto-save the new tag
      await saveTagsToDatabase(newTags);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);

    // Auto-save after removing tag
    await saveTagsToDatabase(newTags);
  };

  const generateAITags = async () => {
    if (!itemToDisplay) return;

    setIsGeneratingTags(true);
    try {
      // Prepare content for tag generation
      const content = itemToDisplay.content || itemToDisplay.desc || itemToDisplay.title || '';

      // Create metadata object for the generateTags function
      const metadata: URLMetadata = {
        url: itemToDisplay.url || '',
        title: itemToDisplay.title,
        description: itemToDisplay.desc || '',
        contentType: itemToDisplay.content_type,
      };

      // Call the actual AI tag generation service
      const generatedTags = await generateTags(content, metadata);

      // Add unique tags not already present
      const uniqueTags = generatedTags.filter(tag => !tags.includes(tag));
      if (uniqueTags.length > 0) {
        const newTags = [...tags, ...uniqueTags];
        setTags(newTags);

        // Auto-save the generated tags
        await saveTagsToDatabase(newTags);
      }
    } catch (error) {
      console.error('Error generating tags:', error);
      alert('Failed to generate tags. Make sure OpenAI API is configured.');
    } finally {
      setIsGeneratingTags(false);
    }
  };

  // Helper function to save tags to database
  const saveTagsToDatabase = async (tagsToSave: string[]) => {
    if (!itemToDisplay) return;

    try {
      await itemsActions.updateItemWithSync(itemToDisplay.id, { tags: tagsToSave });

      console.log('Tags auto-saved successfully');
    } catch (error) {
      console.error('Error saving tags:', error);
      alert('Failed to save tags');
    }
  };

  // Handle metadata refresh
  const handleRefreshMetadata = async () => {
    if (!itemToDisplay) return;

    setIsRefreshingMetadata(true);
    try {
      const success = await itemsActions.refreshMetadata(itemToDisplay.id);
      if (success) {
        Alert.alert('Success', 'Metadata refreshed successfully');
        // Force re-render by updating displayItem with latest from store
        const updatedItem = itemsStore.items.get().find(i => i.id === itemToDisplay.id);
        if (updatedItem) {
          setDisplayItem(updatedItem);
        }
      } else {
        Alert.alert('Error', 'Failed to refresh metadata');
      }
    } catch (error) {
      console.error('Metadata refresh error:', error);
      Alert.alert('Error', 'Failed to refresh metadata');
    } finally {
      setIsRefreshingMetadata(false);
    }
  };

  // Handle content type change
  const handleContentTypeChange = async (newType: ContentType) => {
    if (!itemToDisplay) return;

    setSelectedType(newType);
    setShowTypeSelector(false);

    try {
      // Update the content type in the database
      await itemsActions.updateItemWithSync(itemToDisplay.id, { content_type: newType });

      // Update local displayItem
      setDisplayItem({ ...itemToDisplay, content_type: newType });

      // Ask if user wants to refresh metadata with new type
      if (itemToDisplay.url) {
        Alert.alert(
          'Refresh Metadata?',
          'Would you like to re-extract metadata for this item based on the new content type?',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Refresh',
              onPress: handleRefreshMetadata,
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error updating content type:', error);
      Alert.alert('Error', 'Failed to update content type');
    }
  };

  return (
    <View style={styles.container}>
      {/* Reddit Header with Orange Border */}
      <View style={[styles.redditHeader, isDarkMode && styles.redditHeaderDark]}>
        <Text style={styles.redditIcon}>🤖</Text>
        {subreddit && (
          <Text style={[styles.subreddit, isDarkMode && styles.subredditDark]}>
            {subreddit}
          </Text>
        )}
        {redditMetadata?.link_flair_text && (
          <View
            style={[
              styles.flairBadge,
              {
                backgroundColor: redditMetadata.link_flair_background_color || '#373c3f',
              },
            ]}
          >
            <Text
              style={[
                styles.flairText,
                {
                  color: redditMetadata.link_flair_text_color === 'light' ? '#FFFFFF' : '#000000',
                },
              ]}
            >
              {redditMetadata.link_flair_text}
            </Text>
          </View>
        )}
      </View>

      {/* Hero Image/Carousel */}
      {(() => {
        const imageUrls = itemTypeMetadataComputed.getImageUrls(itemToDisplay?.id || '');
        const hasMultipleImages = imageUrls && imageUrls.length > 1;

        if (itemToDisplay?.thumbnail_url) {
          return (
            <View style={styles.heroContainer}>
              <View style={{ position: 'relative' }}>
                <ImageWithActions
                  source={{ uri: itemToDisplay.thumbnail_url }}
                  imageUrl={itemToDisplay.thumbnail_url}
                  style={styles.heroMedia}
                  contentFit="contain"
                  canReplace
                  canRemove={!!itemToDisplay.thumbnail_url}
                  onImageReplace={() => imageUploadModalRef.current?.open()}
                  onImageRemove={handleHeroImageRemove}
                />
                {redditMetadata?.video_duration && (
                  <View style={styles.durationOverlay}>
                    <Text style={styles.durationText}>
                      ⏱️ {formatDuration(redditMetadata.video_duration)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        }

        if (hasMultipleImages) {
          return (
            <View style={styles.heroContainer}>
              <View style={{ position: 'relative', width: CONTENT_WIDTH, height: CONTENT_WIDTH, borderRadius: 12, overflow: 'hidden' }}>
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled={true}
                  directionalLockEnabled={true}
                  onMomentumScrollEnd={(event) => {
                    const newIndex = Math.round(event.nativeEvent.contentOffset.x / CONTENT_WIDTH);
                    setCurrentImageIndex(newIndex);
                  }}
                  scrollEventThrottle={16}
                  style={{ width: CONTENT_WIDTH, height: CONTENT_WIDTH }}
                  contentContainerStyle={{ height: CONTENT_WIDTH }}
                >
                  {imageUrls!.map((imageUrl, index) => (
                    <ImageWithActions
                      key={index}
                      source={{ uri: imageUrl }}
                      imageUrl={imageUrl}
                      style={{
                        width: CONTENT_WIDTH,
                        height: CONTENT_WIDTH,
                        backgroundColor: '#000000'
                      }}
                      contentFit="contain"
                      canReplace
                      onImageReplace={() => imageUploadModalRef.current?.open()}
                    />
                  ))}
                </ScrollView>
                <View style={styles.dotsContainer}>
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
              </View>
            </View>
          );
        }

        if (imageUrls && imageUrls.length === 1) {
          return (
            <View style={styles.heroContainer}>
              <ImageWithActions
                source={{ uri: imageUrls[0] }}
                imageUrl={imageUrls[0]}
                style={styles.heroMedia}
                contentFit="contain"
                canReplace
                onImageReplace={() => imageUploadModalRef.current?.open()}
              />
            </View>
          );
        }

        return (
          <View style={styles.heroContainer}>
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
          </View>
        );
      })()}

      {/* Content */}
      <View style={styles.content}>
        {/* Title and Metadata (inline editable title) */}
        <InlineEditableText
          value={itemToDisplay?.title || ''}
          placeholder="Tap to add title"
          onSave={async (newTitle) => {
            await itemsActions.updateItemWithSync(itemToDisplay.id, { title: newTitle });
          }}
          style={[styles.title, isDarkMode && styles.titleDark]}
          isDarkMode={isDarkMode}
        />

        {/* Content Warning Badges */}
        {redditMetadata && (redditMetadata.spoiler || redditMetadata.over_18 || redditMetadata.locked || redditMetadata.stickied) && (
          <View style={styles.warningBadges}>
            {redditMetadata.spoiler && (
              <View style={[styles.warningBadge, styles.spoilerBadge]}>
                <Text style={styles.warningBadgeText}>⚠️ SPOILER</Text>
              </View>
            )}
            {redditMetadata.over_18 && (
              <View style={[styles.warningBadge, styles.nsfwBadge]}>
                <Text style={styles.warningBadgeText}>🔞 NSFW</Text>
              </View>
            )}
            {redditMetadata.locked && (
              <View style={[styles.warningBadge, styles.lockedBadge]}>
                <Text style={styles.warningBadgeText}>🔒 Locked</Text>
              </View>
            )}
            {redditMetadata.stickied && (
              <View style={[styles.warningBadge, styles.stickiedBadge]}>
                <Text style={styles.warningBadgeText}>📌 Pinned</Text>
              </View>
            )}
          </View>
        )}

        {/* Engagement Metrics */}
        {redditMetadata && (
          <View style={[styles.engagementBar, isDarkMode && styles.engagementBarDark]}>
            <Text style={[styles.engagementText, isDarkMode && styles.engagementTextDark]}>
              ⬆️ {formatNumber(redditMetadata.ups)} • 💬 {formatNumber(redditMetadata.num_comments)} • {Math.round(redditMetadata.upvote_ratio * 100)}% upvoted
            </Text>
            {redditMetadata.total_awards_received > 0 && (
              <Text style={[styles.engagementText, isDarkMode && styles.engagementTextDark]}>
                {' '}• 🏆 {redditMetadata.total_awards_received}
              </Text>
            )}
            {redditMetadata.num_crossposts > 0 && (
              <Text style={[styles.engagementText, isDarkMode && styles.engagementTextDark]}>
                {' '}• 🔄 {redditMetadata.num_crossposts}
              </Text>
            )}
          </View>
        )}

        <View style={styles.metadata}>
          {getDomain() && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
                {getDomain()}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
              {formatDate(itemToDisplay?.created_at || '')}
            </Text>
          </View>
        </View>

        {/* Description (inline editable) */}
        <View style={styles.descriptionSection}>
          <Text style={[styles.descriptionSectionLabel, isDarkMode && styles.descriptionSectionLabelDark]}>
            DESCRIPTION
          </Text>
          <InlineEditableText
            value={itemToDisplay?.desc || ''}
            placeholder="Tap to add description"
            onSave={async (newDesc) => {
              await itemsActions.updateItemWithSync(itemToDisplay.id, { desc: newDesc });
              setDisplayItem({ ...(itemToDisplay as Item), desc: newDesc });
            }}
            style={[styles.descriptionText, isDarkMode && styles.descriptionTextDark]}
            multiline
            maxLines={8}
            collapsible
            collapsedLines={6}
            showMoreThreshold={300}
            isDarkMode={isDarkMode}
          />
        </View>

        {/* Tags Section */}
        <View style={styles.tagsSection}>
          <View style={styles.tagsSectionHeader}>
            <Text style={[styles.tagsSectionLabel, isDarkMode && styles.tagsSectionLabelDark]}>
              TAGS
            </Text>
          </View>
          <TagsEditor
            tags={tags}
            onChangeTags={async (newTags) => {
              setTags(newTags);
              await saveTagsToDatabase(newTags);
            }}
            generateTags={async () => {
              if (!itemToDisplay) return [] as string[];
              const content = itemToDisplay.content || itemToDisplay.desc || itemToDisplay.title || '';
              const metadata: URLMetadata = {
                url: itemToDisplay.url || '',
                title: itemToDisplay.title,
                description: itemToDisplay.desc || '',
                contentType: itemToDisplay.content_type,
              };
              const generated = await generateTags(content, metadata);
              return generated || [];
            }}
            buttonLabel="✨ Generate Tags"
          />
        </View>

        {/* Full Content */}
        {/* {itemToDisplay?.content && (
          <View style={styles.fullContent}>
            <Text style={[styles.contentText, isDarkMode && styles.contentTextDark]}>
              {itemToDisplay.content}
            </Text>
          </View>
        )} */}

        {/* Space Selector */}
        <View style={styles.spaceSection}>
          <Text style={[styles.spaceSectionLabel, isDarkMode && styles.spaceSectionLabelDark]}>
            SPACES
          </Text>
          <TouchableOpacity
            style={[styles.spaceSelector, isDarkMode && styles.spaceSelectorDark]}
            onPress={() => {
              setShowSpaceSelector(!showSpaceSelector);
              setShowTypeSelector(false);
            }}
            activeOpacity={0.7}
          >
            {selectedSpaceIds.length > 0 ? (
              <View style={styles.selectedSpaces}>
                {selectedSpaceIds.slice(0, 3).map(spaceId => {
                  const space = spaces.find(s => s.id === spaceId);
                  return space ? (
                    <View key={spaceId} style={styles.selectedSpaceTag}>
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
                })}
                {selectedSpaceIds.length > 3 && (
                  <Text style={[styles.moreSpaces, isDarkMode && styles.moreSpacesDark]}>
                    +{selectedSpaceIds.length - 3} more
                  </Text>
                )}
              </View>
            ) : (
              <Text style={[styles.noSpace, isDarkMode && styles.noSpaceDark]}>
                No spaces assigned
              </Text>
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

                    if (itemToDisplay) {
                      const currentSpaceIds = itemSpacesComputed.getSpaceIdsForItem(itemToDisplay.id);

                      for (const spaceId of newSelectedIds) {
                        if (!currentSpaceIds.includes(spaceId)) {
                          await itemSpacesActions.addItemToSpace(itemToDisplay.id, spaceId);
                          const space = spaces.find(s => s.id === spaceId);
                          if (space) {
                            spacesActions.updateSpace(spaceId, {
                              item_count: (space.item_count || 0) + 1
                            });
                          }
                        }
                      }

                      for (const spaceId of currentSpaceIds) {
                        if (!newSelectedIds.includes(spaceId)) {
                          await itemSpacesActions.removeItemFromSpace(itemToDisplay.id, spaceId);
                          const space = spaces.find(s => s.id === spaceId);
                          if (space) {
                            spacesActions.updateSpace(spaceId, {
                              item_count: Math.max(0, (space.item_count || 0) - 1)
                            });
                          }
                        }
                      }
                    }
                  }}
                >
                  <View style={styles.spaceOptionContent}>
                    <View style={[
                      styles.checkbox,
                      selectedSpaceIds.includes(space.id) && styles.checkboxSelected,
                      selectedSpaceIds.includes(space.id) && { backgroundColor: space.color }
                    ]}>
                      {selectedSpaceIds.includes(space.id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.spaceColorDot,
                        { backgroundColor: space.color }
                      ]}
                    />
                    <Text style={[styles.spaceOptionText, isDarkMode && styles.spaceOptionTextDark]}>
                      {space.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {selectedSpaceIds.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearButton]}
                  onPress={async () => {
                    if (itemToDisplay) {
                      const currentSpaceIds = itemSpacesComputed.getSpaceIdsForItem(itemToDisplay.id);

                      for (const spaceId of currentSpaceIds) {
                        await itemSpacesActions.removeItemFromSpace(itemToDisplay.id, spaceId);
                        const space = spaces.find(s => s.id === spaceId);
                        if (space) {
                          spacesActions.updateSpace(spaceId, {
                            item_count: Math.max(0, (space.item_count || 0) - 1)
                          });
                        }
                      }
                    }
                    setSelectedSpaceIds([]);
                  }}
                >
                  <Text style={[styles.clearButtonText, isDarkMode && styles.clearButtonTextDark]}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* URL Display */}
        {itemToDisplay?.url && (
          <View style={styles.urlSection}>
            <Text style={[styles.urlSectionLabel, isDarkMode && styles.urlSectionLabelDark]}>
              URL
            </Text>
            <View style={[styles.urlContainer, isDarkMode && styles.urlContainerDark]}>
              <View style={styles.urlContent}>
                <Text style={[styles.urlText, isDarkMode && styles.urlTextDark]} numberOfLines={2}>
                  {itemToDisplay.url}
                </Text>
              </View>
              <View style={styles.urlActions}>
                <TouchableOpacity
                  style={[styles.urlActionButton, isDarkMode && styles.urlActionButtonDark]}
                  onPress={async () => {
                    if (itemToDisplay?.url) {
                      await Clipboard.setStringAsync(itemToDisplay.url);
                      Alert.alert('Copied', 'URL copied to clipboard');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.urlActionIcon}>📋</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.urlActionButton, isDarkMode && styles.urlActionButtonDark]}
                  onPress={async () => {
                    if (itemToDisplay?.url) {
                      await Linking.openURL(itemToDisplay.url);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.urlActionIcon}>🔗</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Type Selector */}
        <View style={styles.typeSection}>
          <Text style={[styles.typeSectionLabel, isDarkMode && styles.typeSectionLabelDark]}>
            CONTENT TYPE
          </Text>
          <TouchableOpacity
            style={[styles.typeSelector, isDarkMode && styles.typeSelectorDark]}
            onPress={() => {
              setShowTypeSelector(!showTypeSelector);
              setShowSpaceSelector(false);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.selectedType}>
              <Text style={styles.typeIcon}>
                {contentTypeOptions.find(t => t.type === selectedType)?.icon || '📎'}
              </Text>
              <Text style={[styles.typeName, isDarkMode && styles.typeNameDark]}>
                {contentTypeOptions.find(t => t.type === selectedType)?.label || 'Unknown'}
              </Text>
            </View>
            <Text style={styles.chevron}>{showTypeSelector ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showTypeSelector && (
            <View style={[styles.typeOptions, isDarkMode && styles.typeOptionsDark]}>
              {contentTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.type}
                  style={[
                    styles.typeOption,
                    selectedType === option.type && styles.typeOptionSelected
                  ]}
                  onPress={() => handleContentTypeChange(option.type)}
                >
                  <View style={styles.typeOptionContent}>
                    <Text style={styles.typeOptionIcon}>{option.icon}</Text>
                    <Text style={[styles.typeOptionText, isDarkMode && styles.typeOptionTextDark]}>
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Image Descriptions Section */}
        {(() => {
          const imageUrls = itemTypeMetadataComputed.getImageUrls(itemToDisplay?.id || '');
          return imageUrls && imageUrls.length > 0;
        })() && (
          <View style={styles.imageDescriptionsSection}>
            <Text style={[styles.imageDescriptionsSectionLabel, isDarkMode && styles.imageDescriptionsSectionLabelDark]}>
              IMAGE DESCRIPTIONS
            </Text>

            {!imageDescriptionsExist ? (
              <Animated.View style={{ opacity: imageDescriptionsButtonOpacity }}>
                <TouchableOpacity
                  style={[
                    styles.imageDescriptionsGenerateButton,
                    (isGeneratingImageDescriptions || imageDescriptionsComputed.isGenerating(itemToDisplay?.id || '')) && styles.imageDescriptionsGenerateButtonDisabled,
                    isDarkMode && styles.imageDescriptionsGenerateButtonDark
                  ]}
                  onPress={generateImageDescriptions}
                  disabled={isGeneratingImageDescriptions || imageDescriptionsComputed.isGenerating(itemToDisplay?.id || '')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.imageDescriptionsGenerateButtonText}>
                    {(isGeneratingImageDescriptions || imageDescriptionsComputed.isGenerating(itemToDisplay?.id || '')) ? '⏳ Processing...' : '⚡ Generate'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View style={{ opacity: imageDescriptionsOpacity }}>
                <TouchableOpacity
                  style={[styles.imageDescriptionsSelector, isDarkMode && styles.imageDescriptionsSelectorDark]}
                  onPress={() => setShowImageDescriptions(!showImageDescriptions)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.imageDescriptionsSelectorText, isDarkMode && styles.imageDescriptionsSelectorTextDark]}>
                    {showImageDescriptions ? 'Hide Descriptions' : `View Descriptions (${imageDescriptions.length})`}
                  </Text>
                  <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>
                    {showImageDescriptions ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {showImageDescriptions && (
                  <View style={[styles.imageDescriptionsContent, isDarkMode && styles.imageDescriptionsContentDark]}>
                    <ScrollView style={styles.imageDescriptionsScrollView} showsVerticalScrollIndicator={false}>
                      {imageDescriptions.map((desc, idx) => (
                        <View key={desc.id} style={styles.imageDescriptionItem}>
                          <Text style={[styles.imageDescriptionLabel, isDarkMode && styles.imageDescriptionLabelDark]}>
                            Image {idx + 1}:
                          </Text>
                          <Text style={[styles.imageDescriptionText, isDarkMode && styles.imageDescriptionTextDark]}>
                            {desc.description}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                    <TouchableOpacity
                      style={styles.imageDescriptionsCopyButton}
                      onPress={copyImageDescriptionsToClipboard}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.imageDescriptionsCopyButtonText}>📋</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction]}
            onPress={() => {
              onChat?.(itemToDisplay!);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonTextPrimary}>💬 Chat</Text>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEdit?.(itemToDisplay!)}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>
                ✏️ Edit
              </Text>
            </TouchableOpacity>

            {itemToDisplay?.url && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleRefreshMetadata}
                disabled={isRefreshingMetadata}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>
                  {isRefreshingMetadata ? '⏳ Refreshing...' : '🔄 Refresh'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onShare?.(itemToDisplay!)}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>
                📤 Share
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onArchive?.(itemToDisplay!)}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>
                📦 Archive
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => onDelete?.(itemToDisplay!)}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ImageUploadModal
        ref={imageUploadModalRef}
        onImageSelected={handleHeroImageSelected}
      />
    </View>
  );
});

export default RedditItemView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  redditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: 12,
    // borderTopWidth: 5,
    // borderTopColor: '#FF4500', // Reddit orange
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  redditHeaderDark: {
    backgroundColor: '#1C1C1E',
  },
  redditIcon: {
    fontSize: 20,
  },
  subreddit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4500',
  },
  subredditDark: {
    color: '#FF6B35',
  },
  heroContainer: {
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: 12,
  },
  heroMedia: {
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  placeholderHero: {
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH,
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
  content: {
    padding: 20,
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
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaItem: {
    marginRight: 16,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: '#666',
  },
  metaLabelDark: {
    color: '#999',
  },
  urlSection: {
    marginBottom: 20,
  },
  urlSectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urlSectionLabelDark: {
    color: '#999',
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
  },
  urlContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  urlContent: {
    flex: 1,
    marginRight: 8,
  },
  urlActions: {
    flexDirection: 'row',
    gap: 8,
  },
  urlActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlActionButtonDark: {
    backgroundColor: '#3A3A3C',
  },
  urlActionIcon: {
    fontSize: 18,
  },
  urlText: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  urlTextDark: {
    color: '#5AC8FA',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionSectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descriptionSectionLabelDark: {
    color: '#999',
  },
  descriptionContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  descriptionContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  descriptionTextDark: {
    color: '#CCC',
  },
  expandToggle: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    fontWeight: '500',
  },
  expandToggleDark: {
    color: '#5AC8FA',
  },
  fullContent: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  contentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  contentTextDark: {
    color: '#CCC',
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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  spaceTagText: {
    fontSize: 12,
    color: '#333',
  },
  spaceTagTextDark: {
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
  spaceColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
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
  chevronDark: {
    color: '#999',
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
  spaceOptionText: {
    fontSize: 14,
    color: '#333',
  },
  spaceOptionTextDark: {
    color: '#FFF',
  },
  typeSection: {
    marginBottom: 20,
  },
  typeSectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeSectionLabelDark: {
    color: '#999',
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
  selectedType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    fontSize: 16,
  },
  typeName: {
    fontSize: 16,
    color: '#000',
  },
  typeNameDark: {
    color: '#FFF',
  },
  typeOptions: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  typeOptionsDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  typeOption: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  typeOptionSelected: {
    backgroundColor: '#F0F0F0',
  },
  typeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeOptionIcon: {
    fontSize: 16,
  },
  typeOptionText: {
    fontSize: 15,
    color: '#000',
  },
  typeOptionTextDark: {
    color: '#FFF',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  imageDescriptionsSection: {
    marginBottom: 20,
  },
  imageDescriptionsSectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageDescriptionsSectionLabelDark: {
    color: '#999',
  },
  imageDescriptionsGenerateButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageDescriptionsGenerateButtonDark: {
    backgroundColor: '#0A84FF',
  },
  imageDescriptionsGenerateButtonDisabled: {
    backgroundColor: '#999',
  },
  imageDescriptionsGenerateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imageDescriptionsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  imageDescriptionsSelectorDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3C3C3E',
  },
  imageDescriptionsSelectorText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  imageDescriptionsSelectorTextDark: {
    color: '#FFF',
  },
  imageDescriptionsContent: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  imageDescriptionsContentDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  imageDescriptionsScrollView: {
    maxHeight: 300,
  },
  imageDescriptionItem: {
    marginBottom: 16,
  },
  imageDescriptionLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  imageDescriptionLabelDark: {
    color: '#999',
  },
  imageDescriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  imageDescriptionTextDark: {
    color: '#CCC',
  },
  imageDescriptionsCopyButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageDescriptionsCopyButtonText: {
    fontSize: 20,
  },
  tagsSection: {
    marginBottom: 20,
  },
  tagsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tagsSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#666',
  },
  tagsSectionLabelDark: {
    color: '#999',
  },
  // Removed local tag styles in favor of shared TagsEditor styles
  // Flair badge styles
  flairBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  flairText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // Video duration overlay
  durationOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Warning badges
  warningBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  warningBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  spoilerBadge: {
    backgroundColor: '#FFB300',
  },
  nsfwBadge: {
    backgroundColor: '#FF3B30',
  },
  lockedBadge: {
    backgroundColor: '#8E8E93',
  },
  stickiedBadge: {
    backgroundColor: '#34C759',
  },
  warningBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  // Engagement bar
  engagementBar: {
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  engagementBarDark: {
    backgroundColor: '#2C2C2E',
  },
  engagementText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  engagementTextDark: {
    color: '#E5E5E7',
  },
});
