import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { videoTranscriptsActions, videoTranscriptsComputed } from '../../stores/videoTranscripts';
import { imageDescriptionsActions, imageDescriptionsComputed } from '../../stores/imageDescriptions';
import { VideoTranscript, ImageDescription } from '../../types';
import uuid from 'react-native-uuid';
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
import { itemMetadataComputed } from '../../stores/itemMetadata';
import { aiSettingsComputed } from '../../stores/aiSettings';
import { Item, ContentType } from '../../types';
import { supabase } from '../../services/supabase';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import TagsEditor from '../TagsEditor';
import { openai } from '../../services/openai';
import { getYouTubeTranscript } from '../../services/youtube';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import InlineEditableText from '../InlineEditableText';
import { ImageWithActions } from '../ImageWithActions';

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

interface YouTubeItemViewProps {
  item: Item | null;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  currentSpaceId?: string | null;
}

const YouTubeItemView = observer(({
  item,
  onChat,
  onEdit,
  onArchive,
  onDelete,
  onShare,
  currentSpaceId,
}: YouTubeItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>(currentSpaceId ? [currentSpaceId] : []);
  const allSpaces = spacesStore.spaces.get();
  const spaces = allSpaces;
  const [displayItem, setDisplayItem] = useState<Item | null>(null);

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState(item?.content_type || 'youtube');
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [transcriptExists, setTranscriptExists] = useState(false);
  const [transcriptStats, setTranscriptStats] = useState({ chars: 0, words: 0, readTime: 0 });
  const transcriptOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(1);

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);

  const isShort = displayItem?.content_type === 'youtube_short';

  useEffect(() => {
    console.log('📄 [YouTubeItemView] useEffect - item changed:', item?.title || 'null');
    if (item) {
      setDisplayItem(item);
      setSelectedType(item.content_type);
      const spaceIds = itemSpacesComputed.getSpaceIdsForItem(item.id);
      setSelectedSpaceIds(spaceIds);

      setTags(item.tags || []);
      setShowAllTags(false);

      // Check for existing transcript
      if (item.content_type === 'youtube' || item.content_type === 'youtube_short') {
        checkForExistingTranscript(item.id);
      }
    }
  }, [item]);

  // Watch for changes in video transcripts store
  useEffect(() => {
    if (itemToDisplay) {
      const existingTranscript = videoTranscriptsComputed.getTranscriptByItemId(itemToDisplay.id);

      if (existingTranscript && existingTranscript.transcript) {
        console.log('📄 [YouTubeItemView] Transcript detected in store, length:', existingTranscript.transcript.length);
        const transcriptText = existingTranscript.transcript;
        setTranscript(transcriptText);
        setTranscriptStats(calculateTranscriptStats(transcriptText));
        setTranscriptExists(true);

        buttonOpacity.value = withTiming(0, { duration: 150 }, () => {
          transcriptOpacity.value = withTiming(1, { duration: 150 });
        });
      } else {
        setTranscript('');
        setTranscriptStats({ chars: 0, words: 0, readTime: 0 });
        setTranscriptExists(false);
        transcriptOpacity.value = 0;
        buttonOpacity.value = 1;
      }
    }
  }, [itemToDisplay?.id, videoTranscriptsComputed.transcripts()]);

  const itemToDisplay = displayItem || item;
  if (!itemToDisplay) {
    return null;
  }

  const calculateTranscriptStats = (text: string) => {
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const readTime = Math.ceil(words / 200);
    return { chars, words, readTime };
  };

  const checkForExistingTranscript = async (itemId: string) => {
    try {
      console.log('Checking for existing transcript for item:', itemId);
      const existingTranscript = videoTranscriptsComputed.getTranscriptByItemId(itemId);

      if (existingTranscript) {
        console.log('Found transcript in local store, length:', existingTranscript.transcript?.length);
        const transcriptText = existingTranscript.transcript;
        setTranscript(transcriptText);
        setTranscriptStats(calculateTranscriptStats(transcriptText));
        setTranscriptExists(true);
        transcriptOpacity.value = 1;
        buttonOpacity.value = 0;
        return;
      }

      console.log('No existing transcript found for item:', itemId);
      setTranscript('');
      setTranscriptStats({ chars: 0, words: 0, readTime: 0 });
      setTranscriptExists(false);
      transcriptOpacity.value = 0;
      buttonOpacity.value = 1;
    } catch (error) {
      console.error('Error checking for transcript:', error);
      setTranscript('');
      setTranscriptExists(false);
      transcriptOpacity.value = 0;
      buttonOpacity.value = 1;
    }
  };

  const getYouTubeVideoId = (url?: string) => {
    if (!url) return null;

    const cleanUrl = url.split('#')[0];
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }

    console.error('Failed to extract YouTube video ID from URL:', url);
    return null;
  };

  const generateTranscript = async () => {
    if (!itemToDisplay || !itemToDisplay.url) return;

    setIsGeneratingTranscript(true);
    videoTranscriptsActions.setGenerating(itemToDisplay.id, true);

    try {
      const videoIdMatch = itemToDisplay.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
      if (!videoIdMatch) {
        throw new Error('Invalid YouTube URL');
      }
      const videoId = videoIdMatch[1];

      const result = await getYouTubeTranscript(videoId);
      const fetchedTranscript = result.transcript;
      const language = result.language;

      const transcriptData: VideoTranscript = {
        id: uuid.v4() as string,
        item_id: itemToDisplay.id,
        transcript: fetchedTranscript,
        platform: 'youtube',
        language,
        duration: itemToDisplay.duration,
        fetched_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await videoTranscriptsActions.addTranscript(transcriptData);
      console.log('Transcript saved to local store and queued for sync');

      setTranscript(fetchedTranscript);
      setTranscriptStats(calculateTranscriptStats(fetchedTranscript));
      setTranscriptExists(true);

      buttonOpacity.value = withTiming(0, { duration: 150 }, () => {
        transcriptOpacity.value = withTiming(1, { duration: 150 });
      });

      setTimeout(() => {
        setShowTranscript(true);
      }, 300);

    } catch (error) {
      console.error('Error generating transcript:', error);
      alert('Failed to generate transcript. The video may not have captions available.');
    } finally {
      setIsGeneratingTranscript(false);
      videoTranscriptsActions.setGenerating(itemToDisplay.id, false);
    }
  };

  const copyTranscriptToClipboard = async () => {
    if (transcript) {
      await Clipboard.setStringAsync(transcript);
    }
  };

  const downloadThumbnail = async () => {
    if (!itemToDisplay?.thumbnail_url) {
      Alert.alert('Error', 'No thumbnail to download');
      return;
    }

    try {
      setIsDownloading(true);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Need permission to save images');
        return;
      }

      const filename = `youtube_thumbnail_${Date.now()}.jpg`;
      const result = await FileSystem.downloadAsync(
        itemToDisplay.thumbnail_url,
        FileSystem.documentDirectory + filename
      );

      const asset = await MediaLibrary.createAssetAsync(result.uri);
      await MediaLibrary.createAlbumAsync('Memex', asset, false);

      Alert.alert('Success', 'Thumbnail saved to your photo library');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download thumbnail');
    } finally {
      setIsDownloading(false);
    }
  };

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

  const getDomain = () => {
    if (!itemToDisplay?.url) return null;
    try {
      const url = new URL(itemToDisplay.url);
      return url.hostname.replace('www.', '');
    } catch {
      return null;
    }
  };

  // Tag management
  const addTag = async () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const newTags = [...tags, trimmedTag];
      setTags(newTags);
      setTagInput('');
      await saveTagsToDatabase(newTags);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    await saveTagsToDatabase(newTags);
  };

  const generateAITags = async () => {
    if (!itemToDisplay) return;

    setIsGeneratingTags(true);
    try {
      const content = itemToDisplay.content || itemToDisplay.desc || itemToDisplay.title || '';

      const metadata: URLMetadata = {
        url: itemToDisplay.url || '',
        title: itemToDisplay.title,
        description: itemToDisplay.desc || '',
        contentType: itemToDisplay.content_type,
      };

      const generatedTags = await generateTags(content, metadata);
      const uniqueTags = generatedTags.filter(tag => !tags.includes(tag));
      if (uniqueTags.length > 0) {
        const newTags = [...tags, ...uniqueTags];
        setTags(newTags);
        await saveTagsToDatabase(newTags);
      }
    } catch (error) {
      console.error('Error generating tags:', error);
      alert('Failed to generate tags. Make sure OpenAI API is configured.');
    } finally {
      setIsGeneratingTags(false);
    }
  };

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

  const handleRefreshMetadata = async () => {
    if (!itemToDisplay) return;

    setIsRefreshingMetadata(true);
    try {
      const success = await itemsActions.refreshMetadata(itemToDisplay.id);
      if (success) {
        Alert.alert('Success', 'Metadata refreshed successfully');
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

  const handleContentTypeChange = async (newType: ContentType) => {
    if (!itemToDisplay) return;

    setSelectedType(newType);
    setShowTypeSelector(false);

    try {
      await itemsActions.updateItemWithSync(itemToDisplay.id, { content_type: newType });
      setDisplayItem({ ...itemToDisplay, content_type: newType });

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
      {/* YouTube Video Embed */}
      {getYouTubeVideoId(itemToDisplay?.url) && (
        <View style={styles.videoContainer}>
          <View style={isShort ? styles.youtubeShortEmbed : styles.youtubeEmbed}>
            <WebView
              source={{
                uri: `https://www.youtube-nocookie.com/embed/${getYouTubeVideoId(itemToDisplay.url)}?rel=0&modestbranding=1&playsinline=1`
              }}
              style={styles.webView}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              mixedContentMode="compatibility"
              originWhitelist={['*']}
              userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
            />
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Title and Metadata (inline editable) */}
        <InlineEditableText
          value={itemToDisplay?.title || ''}
          placeholder="Tap to add title"
          onSave={async (newTitle) => {
            await itemsActions.updateItemWithSync(itemToDisplay.id, { title: newTitle });
            setDisplayItem({ ...(itemToDisplay as Item), title: newTitle });
          }}
          style={[styles.title, isDarkMode && styles.titleDark]}
          isDarkMode={isDarkMode}
        />

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
              {formatDate((itemMetadataComputed.getMetadataForItem(itemToDisplay.id)?.published_date as string) || itemToDisplay?.created_at || '')}
            </Text>
          </View>
          {/* Channel link */}
          {(() => {
            const typeMeta = itemTypeMetadataComputed.getTypeMetadataForItem(itemToDisplay.id);
            const channelName = (typeMeta?.data as any)?.channel_name;
            const channelUrl = (typeMeta?.data as any)?.channel_url;
            if (!channelName || !channelUrl) return null;
            return (
              <TouchableOpacity
                style={styles.metaItem}
                onPress={() => Linking.openURL(channelUrl)}
                activeOpacity={0.7}
              >
                <Text style={[styles.metaLabel, { color: '#007AFF' }]}>{channelName}</Text>
              </TouchableOpacity>
            );
          })()}
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

        {/* Thumbnail Section */}
        {itemToDisplay?.thumbnail_url && (
          <View style={styles.thumbnailSection}>
            <Text style={[styles.thumbnailSectionLabel, isDarkMode && styles.thumbnailSectionLabelDark]}>
              THUMBNAIL
            </Text>
            <TouchableOpacity
              style={[styles.thumbnailSelector, isDarkMode && styles.thumbnailSelectorDark]}
              onPress={() => setShowThumbnail(!showThumbnail)}
              activeOpacity={0.7}
            >
              <Text style={[styles.thumbnailSelectorText, isDarkMode && styles.thumbnailSelectorTextDark]}>
                {showThumbnail ? 'Hide Thumbnail' : 'View Thumbnail'}
              </Text>
              <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>
                {showThumbnail ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showThumbnail && (
              <View style={[styles.thumbnailContent, isDarkMode && styles.thumbnailContentDark]}>
                <ImageWithActions
                  source={{ uri: itemToDisplay.thumbnail_url }}
                  imageUrl={itemToDisplay.thumbnail_url}
                  style={styles.thumbnailImage}
                  contentFit="cover"
                />
              </View>
            )}
          </View>
        )}

        {/* Transcript Section */}
        <View style={styles.transcriptSection}>
          <Text style={[styles.transcriptSectionLabel, isDarkMode && styles.transcriptSectionLabelDark]}>
            TRANSCRIPT
          </Text>

          {!transcriptExists ? (
            <Animated.View style={{ opacity: buttonOpacity }}>
              <TouchableOpacity
                style={[
                  styles.transcriptGenerateButton,
                  (isGeneratingTranscript || videoTranscriptsComputed.isGenerating(itemToDisplay?.id || '')) && styles.transcriptGenerateButtonDisabled,
                  isDarkMode && styles.transcriptGenerateButtonDark
                ]}
                onPress={generateTranscript}
                disabled={isGeneratingTranscript || videoTranscriptsComputed.isGenerating(itemToDisplay?.id || '')}
                activeOpacity={0.7}
              >
                <Text style={styles.transcriptGenerateButtonText}>
                  {(isGeneratingTranscript || videoTranscriptsComputed.isGenerating(itemToDisplay?.id || '')) ? '⏳ Processing...' : '⚡ Generate'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: transcriptOpacity }}>
              <TouchableOpacity
                style={[styles.transcriptSelector, isDarkMode && styles.transcriptSelectorDark]}
                onPress={() => setShowTranscript(!showTranscript)}
                activeOpacity={0.7}
              >
                <Text style={[styles.transcriptSelectorText, isDarkMode && styles.transcriptSelectorTextDark]}>
                  {showTranscript ? 'Hide Transcript' : 'View Transcript'}
                </Text>
                <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>
                  {showTranscript ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {showTranscript && (
                <View style={[styles.transcriptContent, isDarkMode && styles.transcriptContentDark]}>
                  <ScrollView style={styles.transcriptScrollView} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.transcriptText, isDarkMode && styles.transcriptTextDark]}>
                      {transcript}
                    </Text>
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.transcriptCopyButton}
                    onPress={copyTranscriptToClipboard}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.transcriptCopyButtonText}>📋</Text>
                  </TouchableOpacity>

                  <View style={[styles.transcriptFooter, isDarkMode && styles.transcriptFooterDark]}>
                    <Text style={[styles.transcriptFooterText, isDarkMode && styles.transcriptFooterTextDark]}>
                      {transcriptStats.chars.toLocaleString()} chars • {transcriptStats.words.toLocaleString()} words • ~{transcriptStats.readTime} min read
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}
        </View>

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
    </View>
  );
});

export default YouTubeItemView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoContainer: {
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: 12,
  },
  youtubeEmbed: {
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH * (9/16),
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  youtubeShortEmbed: {
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH * (16/9),
    backgroundColor: '#000',
    maxHeight: SCREEN_HEIGHT * 0.8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
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
  thumbnailSection: {
    marginBottom: 20,
  },
  thumbnailSectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thumbnailSectionLabelDark: {
    color: '#999',
  },
  thumbnailSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  thumbnailSelectorDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3C3C3E',
  },
  thumbnailSelectorText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  thumbnailSelectorTextDark: {
    color: '#FFF',
  },
  thumbnailContent: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  thumbnailContentDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  thumbnailImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  thumbnailDownloadButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  thumbnailDownloadButtonDisabled: {
    backgroundColor: '#999',
  },
  thumbnailDownloadButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptSection: {
    marginBottom: 20,
  },
  transcriptSectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptSectionLabelDark: {
    color: '#999',
  },
  transcriptGenerateButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptGenerateButtonDark: {
    backgroundColor: '#0A84FF',
  },
  transcriptGenerateButtonDisabled: {
    backgroundColor: '#999',
  },
  transcriptGenerateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  transcriptSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  transcriptSelectorDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3C3C3E',
  },
  transcriptSelectorText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  transcriptSelectorTextDark: {
    color: '#FFF',
  },
  transcriptContent: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  transcriptContentDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  transcriptScrollView: {
    maxHeight: 300,
    paddingBottom: 35,
  },
  transcriptText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  transcriptTextDark: {
    color: '#CCC',
  },
  transcriptCopyButton: {
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
  transcriptCopyButtonText: {
    fontSize: 20,
  },
  transcriptFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(245, 245, 245, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  transcriptFooterDark: {
    backgroundColor: 'rgba(44, 44, 46, 0.98)',
    borderTopColor: '#3A3A3C',
  },
  transcriptFooterText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  transcriptFooterTextDark: {
    color: '#999',
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
});
