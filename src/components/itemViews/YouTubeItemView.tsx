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
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../../contexts/ToastContext';
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
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { itemMetadataComputed } from '../../stores/itemMetadata';
import { aiSettingsComputed } from '../../stores/aiSettings';
import { Item, ContentType } from '../../types';
import { supabase } from '../../services/supabase';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import TagsEditor from '../TagsEditor';
import { openai } from '../../services/openai';
import { getYouTubeTranscript } from '../../services/youtube';
import { serpapi } from '../../services/serpapi';
import { adminPrefsStore } from '../../stores/adminPrefs';
import { trackApiUsage } from '../../services/apiUsageTracking';
import { ItemViewHeader, ItemViewTldr, ItemViewNotes, ItemViewFooter } from './components';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import InlineEditableText from '../InlineEditableText';
import { ImageWithActions } from '../ImageWithActions';
import ImageUploadModal, { ImageUploadModalHandle } from '../ImageUploadModal';
import SpaceSelectorModal from '../SpaceSelectorModal';
import ContentTypeSelectorModal from '../ContentTypeSelectorModal';

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
  onClose?: () => void;
  onChat?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onUnarchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  currentSpaceId?: string | null;
  isDeleting?: boolean;
  isRefreshing?: boolean;
}

const YouTubeItemView = observer(({
  item,
  onClose,
  onChat,
  onArchive,
  onUnarchive,
  onDelete,
  onShare,
  currentSpaceId,
  isDeleting = false,
  isRefreshing = false,
}: YouTubeItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const { showToast } = useToast();
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(currentSpaceId || null);
  const [displayItem, setDisplayItem] = useState<Item | null>(null);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedType, setSelectedType] = useState(item?.content_type || 'youtube');
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [transcriptSegments, setTranscriptSegments] = useState<Array<{ startMs: number; endMs?: number; text: string }> | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [transcriptExists, setTranscriptExists] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const imageUploadModalRef = useRef<ImageUploadModalHandle>(null);

  const isShort = displayItem?.content_type === 'youtube_short';

  useEffect(() => {
    console.log('📄 [YouTubeItemView] useEffect - item changed:', item?.title || 'null');
    if (item) {
      // Get the latest item from store (in case it was updated)
      const latestItem = itemsStore.items.get().find(i => i.id === item.id) || item;

      setDisplayItem(latestItem);
      setSelectedType(latestItem.content_type);
      setSelectedSpaceId(latestItem.space_id || null);

      setTags(latestItem.tags || []);
      setShowAllTags(false);

      // Check for existing transcript
      if (latestItem.content_type === 'youtube' || latestItem.content_type === 'youtube_short') {
        checkForExistingTranscript(latestItem.id);
      }
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

  // Watch for changes in video transcripts store
  useEffect(() => {
    if (itemToDisplay) {
      const existingTranscript = videoTranscriptsComputed.getTranscriptByItemId(itemToDisplay.id);

      if (existingTranscript && existingTranscript.transcript) {
        console.log('📄 [YouTubeItemView] Transcript detected in store, length:', existingTranscript.transcript.length);
        const transcriptText = existingTranscript.transcript;
        setTranscript(transcriptText);
        // Load segments if available (for toggling between timestamped/plain text)
        setTranscriptSegments(existingTranscript.segments || null);
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
        // Load segments if available (for toggling between timestamped/plain text)
        setTranscriptSegments(existingTranscript.segments || null);
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

      const sourcePref = adminPrefsStore.youtubeTranscriptSource.get();
      console.log('[YouTubeItemView][Transcript] Source preference:', sourcePref);
      let fetchedTranscript: string;
      let language: string;
      let segments: Array<{ startMs: number; endMs?: number; text: string }> | undefined;
        if (sourcePref === 'serpapi') {
          const res = await serpapi.fetchYouTubeTranscript(itemToDisplay.url!);
        if ((res as any)?.error) {
          console.warn('[YouTubeItemView][Transcript] SerpAPI failed, falling back to youtubei.js:', (res as any).error);
          const yt = await getYouTubeTranscript(videoId);
          fetchedTranscript = yt.transcript;
          language = yt.language;
            segments = undefined;
        } else {
            fetchedTranscript = (res as any).transcript;
            language = (res as any).language || 'en';
            segments = (res as any).segments;
            // Track API usage for successful transcript generation
            await trackApiUsage('serpapi', 'youtube_transcript', itemToDisplay.id);
        }
      } else {
        console.log('[YouTubeItemView][Transcript] Using youtubei.js');
        const yt = await getYouTubeTranscript(videoId);
        fetchedTranscript = yt.transcript;
        language = yt.language;
          segments = undefined;
      }

      // Format transcript with timestamps if segments are available
      let finalTranscript = fetchedTranscript;
      if (segments && segments.length > 0) {
        // Format segments with timestamps: [mm:ss] text
        finalTranscript = segments
          .map((s) => {
            const mm = Math.floor(s.startMs / 60000);
            const ss = Math.floor((s.startMs % 60000) / 1000);
            const ts = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
            return `[${ts}] ${s.text}`;
          })
          .join('\n');
      }

      const transcriptData: VideoTranscript = {
        id: uuid.v4() as string,
        item_id: itemToDisplay.id,
        transcript: finalTranscript,
        platform: 'youtube',
        language,
        duration: itemToDisplay.duration,
        segments: segments, // Store segments for toggling between timestamped/plain text
        fetched_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await videoTranscriptsActions.addTranscript(transcriptData);
      console.log('Transcript saved to local store and queued for sync');

      setTranscript(finalTranscript);
      setTranscriptSegments(segments || null);
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
      // If segments exist and we're showing plain text (no timestamps), copy plain text from segments
      // Otherwise copy the stored transcript (which may have timestamps)
      const textToCopy = (transcriptSegments && transcriptSegments.length > 0 && !showTimestamps)
        ? transcriptSegments.map(s => s.text).join(' ')
        : transcript;
      await Clipboard.setStringAsync(textToCopy);
      showToast({ message: 'Transcript copied to clipboard', type: 'success' });
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

      showToast({ message: 'Thumbnail saved to your photo library', type: 'success' });
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
        showToast({ message: 'Metadata refreshed successfully', type: 'success' });
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

  const handleImageSelected = async (imageUrl: string, storagePath?: string) => {
    try {
      const { itemTypeMetadataActions } = await import('../../stores/itemTypeMetadata');
      await itemTypeMetadataActions.addImageUrl(itemToDisplay.id, imageUrl, itemToDisplay.content_type);
      showToast({ message: 'Image added successfully', type: 'success' });
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image');
    }
  };

  const handleImageRemove = async (imageUrl: string) => {
    try {
      const { itemTypeMetadataActions } = await import('../../stores/itemTypeMetadata');
      await itemTypeMetadataActions.removeImageUrl(itemToDisplay.id, imageUrl);
      showToast({ message: 'Image removed successfully', type: 'success' });
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ItemViewHeader
        value={itemToDisplay?.title || ''}
        onSave={async (newTitle) => {
          await itemsActions.updateItemWithSync(itemToDisplay.id, { title: newTitle });
          setDisplayItem({ ...(itemToDisplay as Item), title: newTitle });
        }}
        onClose={() => onClose?.()}
        isDarkMode={isDarkMode}
        placeholder="Tap to add title"
      />

      {/* YouTube Video Embed */}
      {getYouTubeVideoId(itemToDisplay?.url) && (
        console.log('🔍 [YouTubeItemView] YouTube video ID:', getYouTubeVideoId(itemToDisplay.url)),
        <View style={styles.videoContainer}>
          <View style={isShort ? styles.youtubeShortEmbed : styles.youtubeEmbed}>
            <WebView
              source={{
                // uri: `https://www.youtube-nocookie.com/embed/${getYouTubeVideoId(itemToDisplay.url)}?rel=0&modestbranding=1&playsinline=1&referrerpolicy=strict-origin-when-cross-origin`
                uri: `https://www.youtube.com/embed/${getYouTubeVideoId(itemToDisplay.url)}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=http://localhost`

              }}
              style={styles.webView}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              mixedContentMode="compatibility"
              originWhitelist={['*']}
              // userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
            />
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Metadata */}
        <View style={styles.metadata}>
          {getDomain() && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
                {getDomain()}
              </Text>
            </View>
          )}
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

        {/* TLDR Section */}
        <ItemViewTldr
          item={itemToDisplay}
          isDarkMode={isDarkMode}
          onTldrChange={(newTldr) => {
            setDisplayItem({ ...itemToDisplay, tldr: newTldr });
          }}
        />

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

        {/* Notes Section */}
        <ItemViewNotes
          item={itemToDisplay}
          isDarkMode={isDarkMode}
          onNotesChange={(newNotes) => {
            setDisplayItem({ ...itemToDisplay, notes: newNotes });
          }}
        />

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

        {/* URL Display */}
        {itemToDisplay?.url && (
          <View style={styles.urlSection}>
            <Text style={[styles.urlSectionLabel, isDarkMode && styles.urlSectionLabelDark]}>
              URL
            </Text>
            <TouchableOpacity
              style={[styles.urlContainer, isDarkMode && styles.urlContainerDark]}
              onPress={async () => {
                if (itemToDisplay?.url) {
                  await Linking.openURL(itemToDisplay.url);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.urlText, isDarkMode && styles.urlTextDark]} numberOfLines={2}>
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

        {/* Type Selector */}
        <View style={styles.typeSection}>
          <Text style={[styles.typeSectionLabel, isDarkMode && styles.typeSectionLabelDark]}>
            CONTENT TYPE
          </Text>
          <TouchableOpacity
            style={[styles.typeSelector, isDarkMode && styles.typeSelectorDark]}
            onPress={() => setShowTypeModal(true)}
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
            <Text style={styles.chevron}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Thumbnail / Images Section */}
        {(() => {
          const imageUrls = itemTypeMetadataComputed.getImageUrls(itemToDisplay?.id || '');
          const hasMultipleImages = imageUrls && imageUrls.length > 1;
          const hasSingleImage = imageUrls && imageUrls.length === 1;

          // Prioritize metadata images over thumbnail_url
          if (hasMultipleImages) {
            return (
              <View style={styles.thumbnailSection}>
                <Text style={[styles.thumbnailSectionLabel, isDarkMode && styles.thumbnailSectionLabelDark]}>
                  IMAGES ({imageUrls!.length})
                </Text>
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
                        canAddAnother
                        canRemove
                        onImageAdd={() => imageUploadModalRef.current?.open()}
                        onImageRemove={() => handleImageRemove(imageUrl)}
                      />
                    ))}
                  </ScrollView>
                  {/* Pagination dots indicator */}
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
          } else if (hasSingleImage) {
            return (
              <View style={styles.thumbnailSection}>
                <Text style={[styles.thumbnailSectionLabel, isDarkMode && styles.thumbnailSectionLabelDark]}>
                  IMAGE
                </Text>
                <ImageWithActions
                  source={{ uri: imageUrls![0] }}
                  imageUrl={imageUrls![0]}
                  style={styles.thumbnailImage}
                  contentFit="contain"
                  canAddAnother
                  canRemove
                  onImageAdd={() => imageUploadModalRef.current?.open()}
                  onImageRemove={() => handleImageRemove(imageUrls![0])}
                />
              </View>
            );
          } else if (itemToDisplay?.thumbnail_url) {
            return (
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
            );
          }
          return null;
        })()}

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
                  <View style={styles.transcriptTopBar}>
                    <TouchableOpacity onPress={() => setShowTimestamps(!showTimestamps)} activeOpacity={0.7}>
                      <Text style={[styles.transcriptSelectorText, isDarkMode && styles.transcriptSelectorTextDark]}>
                        {showTimestamps ? 'Show Plain Text' : 'Show Timestamps'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.transcriptTopBarRight}>
                      <TouchableOpacity onPress={async () => {
                        const srt = (transcriptSegments && transcriptSegments.length > 0)
                        ? transcriptSegments.map((s, idx) => {
                            const toTS = (ms: number) => {
                              const total = Math.max(0, Math.floor(ms));
                              const h = String(Math.floor(total / 3600000)).padStart(2, '0');
                              const m = String(Math.floor((total % 3600000) / 60000)).padStart(2, '0');
                              const sec = String(Math.floor((total % 60000) / 1000)).padStart(2, '0');
                              const msRem = String(total % 1000).padStart(3, '0');
                              return `${h}:${m}:${sec},${msRem}`;
                            };
                            const start = toTS(s.startMs);
                            const end = toTS((s.endMs ?? (s.startMs + 2000)));
                            return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
                          }).join('\n')
                        : transcript;
                      await Clipboard.setStringAsync(srt);
                      showToast({ message: 'SRT copied to clipboard', type: 'success' });
                    }} activeOpacity={0.7}>
                        <Text style={[styles.transcriptSelectorText, { color: '#007AFF' }]}>Copy SRT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.transcriptCopyButton}
                        onPress={copyTranscriptToClipboard}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.transcriptCopyButtonText}>📋</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <ScrollView style={styles.transcriptScrollView} showsVerticalScrollIndicator={false}>
                    {!showTimestamps || !transcriptSegments || transcriptSegments.length === 0 ? (
                      <Text style={[styles.transcriptText, isDarkMode && styles.transcriptTextDark]}>
                        {/* If segments exist but we want plain text, extract plain text from segments; otherwise show stored transcript */}
                        {transcriptSegments && transcriptSegments.length > 0 && !showTimestamps
                          ? transcriptSegments.map(s => s.text).join(' ')
                          : transcript}
                      </Text>
                    ) : (
                      <View>
                        {transcriptSegments.map((s, i) => {
                          const mm = Math.floor(s.startMs / 60000);
                          const ss = Math.floor((s.startMs % 60000) / 1000);
                          const ts = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
                          return (
                            <View key={`${s.startMs}-${i}`} style={{ marginBottom: 8 }}>
                              <Text style={[styles.transcriptText, isDarkMode && styles.transcriptTextDark]}>
                                [{ts}] {s.text}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </ScrollView>

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

        {/* Primary Action */}
        <TouchableOpacity
          style={[styles.chatButton, isDarkMode && styles.chatButtonDark]}
          onPress={() => onChat?.(itemToDisplay!)}
          activeOpacity={0.7}
        >
          <Text style={styles.chatButtonText}>💬 Chat</Text>
        </TouchableOpacity>

        {/* Footer */}
        <ItemViewFooter
          item={itemToDisplay!}
          onRefresh={handleRefreshMetadata}
          onShare={() => onShare?.(itemToDisplay!)}
          onArchive={() => onArchive?.(itemToDisplay!)}
          onUnarchive={() => onUnarchive?.(itemToDisplay!)}
          onDelete={() => onDelete?.(itemToDisplay!)}
          isRefreshing={isRefreshingMetadata || isRefreshing}
          isDeleting={isDeleting}
          isDarkMode={isDarkMode}
        />
      </View>

      {/* Space Selector Modal */}
      <SpaceSelectorModal
        visible={showSpaceModal}
        itemId={itemToDisplay?.id || ''}
        currentSpaceId={selectedSpaceId}
        onClose={() => setShowSpaceModal(false)}
        onSpaceChange={(spaceId) => setSelectedSpaceId(spaceId)}
      />

      <ContentTypeSelectorModal
        visible={showTypeModal}
        itemId={itemToDisplay?.id || ''}
        currentType={selectedType}
        onClose={() => setShowTypeModal(false)}
        onTypeChange={(type) => setSelectedType(type)}
      />

      {/* Image Upload Modal */}
      <ImageUploadModal
        ref={imageUploadModalRef}
        onImageSelected={handleImageSelected}
      />
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
  transcriptTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transcriptTopBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transcriptCopyButton: {
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
});
