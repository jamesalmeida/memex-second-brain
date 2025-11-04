import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image as RNImage,
  Dimensions,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../../contexts/ToastContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import ImageUploadModal, { ImageUploadModalHandle } from '../ImageUploadModal';
import { HeroMediaSection } from './components';
import { videoTranscriptsActions, videoTranscriptsComputed } from '../../stores/videoTranscripts';
import { imageDescriptionsActions, imageDescriptionsComputed } from '../../stores/imageDescriptions';
import { VideoTranscript, ImageDescription } from '../../types';
import uuid from 'react-native-uuid';
import Animated, {
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { observer, useObservable } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { spacesStore, spacesActions } from '../../stores/spaces';
import { itemsStore, itemsActions } from '../../stores/items';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { aiSettingsComputed } from '../../stores/aiSettings';
import { expandedItemUIStore, expandedItemUIActions } from '../../stores/expandedItemUI';
import { adminSettingsStore } from '../../stores/adminSettings';
import { Item, ContentType } from '../../types';
import { supabase } from '../../services/supabase';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import TagsEditor from '../TagsEditor';
import InlineEditableText from '../InlineEditableText';
import { openai } from '../../services/openai';
import { getXVideoTranscript } from '../../services/twitter';
import { itemMetadataComputed } from '../../stores/itemMetadata';
import { ItemViewHeader, ItemViewTldr, ItemViewNotes, ItemViewFooter } from './components';
import { extractUsername } from '../../utils/itemCardHelpers';
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

interface XItemViewProps {
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

const XItemView = observer(({
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
}: XItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const showDescription = adminSettingsStore.settings.ui_show_description.get() ?? false;
  const { showToast } = useToast();
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(currentSpaceId || null);
  const [displayItem, setDisplayItem] = useState<Item | null>(null);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedType, setSelectedType] = useState(item?.content_type || 'x');
  // Note: currentImageIndex and scrollViewRef now handled by HeroMediaSection
  const imageUploadModalRef = useRef<ImageUploadModalHandle>(null);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [transcriptExists, setTranscriptExists] = useState(false);
  const [transcriptStats, setTranscriptStats] = useState({ chars: 0, words: 0, readTime: 0 });
  const transcriptOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(1);

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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const hasInitializedVideo = useRef(false);
  const currentItemId = useRef<string | null>(null);

  // Get video URL from item type metadata
  const videoUrl = displayItem ? itemTypeMetadataComputed.getVideoUrl(displayItem.id) : undefined;

  // Set up video player if item has video
  const videoPlayer = useVideoPlayer(videoUrl || null, player => {
    if (player && videoUrl && !hasInitializedVideo.current) {
      hasInitializedVideo.current = true;
      console.log('🎬 [VideoPlayer] Initializing video player for X post');
      player.loop = true;
      // Always start unmuted in expanded view
      const initialMuted = false;
      console.log('🎬 [VideoPlayer] Setting initial mute state for X video (always unmuted):', initialMuted);
      player.muted = initialMuted;

      player.addListener('playingChange', (isPlaying) => {
        console.log('🎬 [VideoPlayer] Playing state changed:', isPlaying);
        setIsVideoPlaying(isPlaying);
      });

      let volumeChangeTimer: NodeJS.Timeout | null = null;
      let lastMutedValue = initialMuted;

      player.addListener('volumeChange', ({ volume, isMuted }) => {
        console.log('🔇 [VideoPlayer] Volume changed - isMuted:', isMuted, 'volume:', volume);

        // Ignore undefined values
        if (isMuted === undefined) {
          console.log('🔇 [VideoPlayer] isMuted is undefined, ignoring');
          return;
        }

        if (isMuted === lastMutedValue) {
          console.log('🔇 [VideoPlayer] Mute state unchanged, ignoring');
          return;
        }

        if (volumeChangeTimer) {
          clearTimeout(volumeChangeTimer);
        }

        volumeChangeTimer = setTimeout(() => {
          console.log('🔇 [VideoPlayer] Debounced: updating mute preference to:', isMuted);
          lastMutedValue = isMuted;
          expandedItemUIActions.setXVideoMuted(isMuted);
        }, 500);
      });
    }
  });

  useEffect(() => {
    console.log('📄 [XItemView] useEffect - item changed:', item?.title || 'null');
    if (item) {
      // Get the latest item from store (in case it was updated)
      const latestItem = itemsStore.items.get().find(i => i.id === item.id) || item;

      setDisplayItem(latestItem);
      setSelectedType(latestItem.content_type);
      setSelectedSpaceId(latestItem.space_id || null);

      // Note: carousel index is now handled by HeroMediaSection

      const isDifferentItem = currentItemId.current !== latestItem.id;
      currentItemId.current = latestItem.id;

      if (isDifferentItem) {
        console.log('🎬 [VideoPlayer] Different item opened - resetting UI state');
        setIsVideoPlaying(false);
        hasInitializedVideo.current = false;
      } else {
        if (videoPlayer && latestItem.content_type === 'x') {
          const isCurrentlyPlaying = videoPlayer.playing;
          console.log('🎬 [VideoPlayer] Same item reopened - checking player state:', isCurrentlyPlaying);
          setIsVideoPlaying(isCurrentlyPlaying);
        }
      }

      setTags(latestItem.tags || []);
      setShowAllTags(false);

      // Check for existing transcript if X video
      if (latestItem.content_type === 'x' && itemTypeMetadataComputed.getVideoUrl(latestItem.id)) {
        checkForExistingTranscript(latestItem.id);
      }

      // Check for existing image descriptions if item has images
      const imageUrls = itemTypeMetadataComputed.getImageUrls(latestItem.id);
      if (imageUrls && imageUrls.length > 0) {
        checkForExistingImageDescriptions(latestItem.id);
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

  // Watch for changes in image descriptions store
  useEffect(() => {
    if (itemToDisplay) {
      const descriptions = imageDescriptionsComputed.getDescriptionsByItemId(itemToDisplay.id);

      if (descriptions && descriptions.length > 0) {
        console.log('📄 [XItemView] Image descriptions detected in store:', descriptions.length);
        setImageDescriptions(descriptions);
        setImageDescriptionsExist(true);

        imageDescriptionsButtonOpacity.value = withTiming(0, { duration: 150 }, () => {
          imageDescriptionsOpacity.value = withTiming(1, { duration: 150 });
        });
      } else {
        setImageDescriptions([]);
        setImageDescriptionsExist(false);
        imageDescriptionsOpacity.value = 0;
        imageDescriptionsButtonOpacity.value = 1;
      }
    }
  }, [itemToDisplay?.id, imageDescriptionsComputed.descriptions()]);

  // Watch for changes in video transcripts store
  useEffect(() => {
    if (itemToDisplay) {
      const existingTranscript = videoTranscriptsComputed.getTranscriptByItemId(itemToDisplay.id);

      if (existingTranscript && existingTranscript.transcript) {
        console.log('📄 [XItemView] Transcript detected in store, length:', existingTranscript.transcript.length);
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
  const handleHeroImageSelected = async (imageUrl: string, storagePath?: string) => {
    if (!itemToDisplay) return;

    try {
      await itemsActions.updateItemImage(itemToDisplay.id, imageUrl, storagePath);
      setDisplayItem(prev => (prev ? { ...prev, thumbnail_url: imageUrl } : prev));
      showToast({ message: 'Image updated successfully', type: 'success' });
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
      showToast({ message: 'Image removed successfully', type: 'success' });
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  const handleMetadataImageAdd = async (imageUrl: string, storagePath?: string) => {
    if (!itemToDisplay) return;

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
    if (!itemToDisplay) return;

    try {
      const { itemTypeMetadataActions } = await import('../../stores/itemTypeMetadata');
      await itemTypeMetadataActions.removeImageUrl(itemToDisplay.id, imageUrl);
      showToast({ message: 'Image removed successfully', type: 'success' });
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  const metadataForItem = itemMetadataComputed.getMetadataForItem(itemToDisplay.id);
  const username = metadataForItem?.username || extractUsername(itemToDisplay);
  // Prefer post_content (tweet text); fallback to desc or title for legacy items
  // @ts-ignore post_content may not exist in Item type locally yet
  const tweetText = (itemToDisplay as any).post_content || itemToDisplay.desc || itemToDisplay.title;

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

  const generateTranscript = async () => {
    if (!itemToDisplay || itemToDisplay.content_type !== 'x') return;

    const videoUrl = itemTypeMetadataComputed.getVideoUrl(itemToDisplay.id);
    if (!videoUrl) {
      throw new Error('No video found for this X post');
    }

    setIsGeneratingTranscript(true);
    videoTranscriptsActions.setGenerating(itemToDisplay.id, true);

    try {
      const result = await getXVideoTranscript(videoUrl, (status) => {
        console.log('Transcription status:', status);
      });
      const fetchedTranscript = result.transcript;
      const language = result.language;

      const transcriptData: VideoTranscript = {
        id: uuid.v4() as string,
        item_id: itemToDisplay.id,
        transcript: fetchedTranscript,
        platform: 'x',
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
      alert('Failed to generate transcript. Please try again.');
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

  const checkForExistingImageDescriptions = async (itemId: string) => {
    try {
      console.log('Checking for existing image descriptions for item:', itemId);
      const existingDescriptions = imageDescriptionsComputed.getDescriptionsByItemId(itemId);

      if (existingDescriptions && existingDescriptions.length > 0) {
        console.log('Found', existingDescriptions.length, 'image descriptions in local store');
        setImageDescriptions(existingDescriptions);
        setImageDescriptionsExist(true);
        imageDescriptionsOpacity.value = 1;
        imageDescriptionsButtonOpacity.value = 0;
        return;
      }

      console.log('No existing image descriptions found for item:', itemId);
      setImageDescriptions([]);
      setImageDescriptionsExist(false);
      imageDescriptionsOpacity.value = 0;
      imageDescriptionsButtonOpacity.value = 1;
    } catch (error) {
      console.error('Error checking for image descriptions:', error);
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
        const description = await openai.describeImage(imageUrl, {
          model: selectedModel.includes('gpt-4') ? selectedModel : 'gpt-4o-mini',
        });

        if (description) {
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

      setImageDescriptions(generatedDescriptions);
      setImageDescriptionsExist(true);

      imageDescriptionsButtonOpacity.value = withTiming(0, { duration: 150 }, () => {
        imageDescriptionsOpacity.value = withTiming(1, { duration: 150 });
      });

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
    setDisplayItem({ ...itemToDisplay, content_type: newType });

    // Ask about refreshing metadata
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
  };

  // Calculate hasImage for ItemViewHeader
  const metadataImages = itemTypeMetadataComputed.getImageUrls(itemToDisplay.id);
  const hasImage = (metadataImages && metadataImages.length > 0) || !!itemToDisplay.thumbnail_url;

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
        placeholder="Title"
        hasImage={hasImage}
        onAddImage={() => imageUploadModalRef.current?.open()}
        onChangeContentType={() => setShowTypeModal(true)}
        onMoveToSpace={() => setShowSpaceModal(true)}
      />

      {/* X/Twitter Header */}
      <View style={[styles.xHeader, isDarkMode && styles.xHeaderDark]}>
        {metadataForItem?.profile_image ? (
          <Image
            source={{ uri: metadataForItem.profile_image }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : null}
        <View style={styles.nameBlock}>
          {metadataForItem?.author ? (
            <Text style={[styles.authorName, isDarkMode && styles.authorNameDark]}>
              {metadataForItem.author}
            </Text>
          ) : null}
          {username ? (
            <Text style={[styles.username, isDarkMode && styles.usernameDark]}>@{username}</Text>
          ) : null}
        </View>
        <Text style={styles.xIconRight}>𝕏</Text>
      </View>

      {/* Tweet Text (inline editable description/title) */}
      <View style={styles.tweetSection}>
        <InlineEditableText
          value={tweetText || ''}
          placeholder="Tap to add text"
          onSave={async (newText) => {
            // Prefer updating desc; fallback to title if no desc existed
            await itemsActions.updateItemWithSync(itemToDisplay.id, { desc: newText, title: itemToDisplay.title || newText });
            setDisplayItem({ ...(itemToDisplay as Item), desc: newText, title: (itemToDisplay.title || newText) });
          }}
          style={[styles.tweetText, isDarkMode && styles.tweetTextDark]}
          multiline
          maxLines={8}
          isDarkMode={isDarkMode}
        placeholder="Title"
        />
      </View>

      {/* Hero Media - Video or Images */}
      <HeroMediaSection
        item={itemToDisplay!}
        isDarkMode={isDarkMode}
        placeholder="Title"
        contentTypeIcon="𝕏"
        videoUrl={videoUrl}
        videoPlayer={videoPlayer}
        isVideoPlaying={isVideoPlaying}
        onVideoPlay={() => {
          if (videoPlayer) {
            videoPlayer.play();
            setIsVideoPlaying(true);
          }
        }}
        showPlayButton={true}
        onImageAdd={() => imageUploadModalRef.current?.open()}
        onImageRemove={handleMetadataImageRemove}
        onThumbnailRemove={handleHeroImageRemove}
        containerStyle={styles.mediaContainer}
      />

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
        </View>

        {/* TLDR Section */}
        <ItemViewTldr
          item={itemToDisplay}
          isDarkMode={isDarkMode}
        placeholder="Title"
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
        placeholder="Title"
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

        {/* Transcript Section (for X Videos) */}
        {(videoUrl || transcriptExists) && (
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
        )}

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
        placeholder="Title"
        />
      </View>

      <ImageUploadModal
        ref={imageUploadModalRef}
        onImageSelected={handleMetadataImageAdd}
      />

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
        onTypeChange={handleContentTypeChange}
      />
    </View>
  );
});

export default XItemView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  xHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CONTENT_PADDING,
    // paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  xHeaderDark: {
    backgroundColor: '#1C1C1E',
  },
  xIcon: {
    fontSize: 20,
    color: '#1DA1F2',
  },
  xIconRight: {
    fontSize: 32,
    color: '#1DA1F2',
    marginLeft: 'auto',
    marginRight: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  nameBlock: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: 8,
  },
  authorName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  authorNameDark: {
    color: '#FFFFFF',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: 'gray',
  },
  usernameDark: {
    color: 'gray',
  },
  tweetSection: {
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: 12,
  },
  tweetText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  tweetTextDark: {
    color: '#FFFFFF',
  },
  mediaContainer: {
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
  videoPlayButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  videoPlayButtonIcon: {
    fontSize: 40,
    color: '#000',
    marginLeft: 5,
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
