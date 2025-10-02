import React, { useEffect, useRef, useState, forwardRef, useMemo, useCallback } from 'react';
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
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getYouTubeTranscript } from '../services/youtube';
import { STORAGE_KEYS } from '../constants';
import { useVideoPlayer, VideoView } from 'expo-video';
import { videoTranscriptsActions, videoTranscriptsComputed } from '../stores/videoTranscripts';
import { VideoTranscript } from '../types';
import uuid from 'react-native-uuid';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { observer, useObservable } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../stores/theme';
import { spacesStore, spacesActions } from '../stores/spaces';
import { itemsStore, itemsActions } from '../stores/items';
import { itemSpacesComputed, itemSpacesActions } from '../stores/itemSpaces';
import { itemTypeMetadataComputed } from '../stores/itemTypeMetadata';
import { itemMetadataComputed } from '../stores/itemMetadata';
import { Item, Space, ContentType } from '../types';
import { supabase } from '../services/supabase';
import { generateTags, URLMetadata } from '../services/urlMetadata';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface ExpandedItemViewProps {
  item: Item | null;
  onClose?: () => void;
  onOpen?: () => void;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  onSpaceChange?: (item: Item, spaceId: string | null) => void;
  currentSpaceId?: string | null;
}

const ExpandedItemView = observer(
  forwardRef<BottomSheet, ExpandedItemViewProps>(({
  item,
  onClose,
  onOpen,
  onChat,
  onEdit,
  onArchive,
  onDelete,
  onShare,
  onSpaceChange,
  currentSpaceId,
}, ref) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>(currentSpaceId ? [currentSpaceId] : []);
  const allSpaces = spacesStore.spaces.get();

  // Just use all spaces without filtering
  const spaces = allSpaces;
  const [displayItem, setDisplayItem] = useState<Item | null>(null);

  // Bottom sheet configuration
  const snapPoints = useMemo(() => ['95%'], []);

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.9}
      />
    ),
    []
  );
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState(item?.content_type || 'bookmark');
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [transcriptSectionY, setTranscriptSectionY] = useState<number>(0);
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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);

  // Get video URL from item type metadata
  const videoUrl = displayItem ? itemTypeMetadataComputed.getVideoUrl(displayItem.id) : undefined;
  
  // Set up video player if item has video
  const videoPlayer = useVideoPlayer(videoUrl || null, player => {
    if (player && videoUrl) {
      player.loop = true;
      // For X posts, don't autoplay - user must press play
      // For other videos, allow autoplay
      if (displayItem?.content_type === 'x') {
        player.muted = true; // Start muted for X posts
        // Don't call player.play() - user must manually play
        
        // Add event listeners to track playing state
        player.addListener('playingChange', (isPlaying) => {
          setIsVideoPlaying(isPlaying);
        });
      } else {
        player.muted = false;
        player.play();
        setIsVideoPlaying(true);
      }
    }
  });

  const calculateTranscriptStats = (text: string) => {
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const readTime = Math.ceil(words / 200); // Average reading speed: 200 words per minute
    return { chars, words, readTime };
  };

  const checkForExistingTranscript = async (itemId: string) => {
    try {
      console.log('Checking for existing transcript for item:', itemId);
      
      // Check local store for transcript
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
      
      // No transcript found
      console.log('No existing transcript found for item:', itemId);
      setTranscript('');
      setTranscriptStats({ chars: 0, words: 0, readTime: 0 });
      setTranscriptExists(false);
      transcriptOpacity.value = 0;
      buttonOpacity.value = 1;
    } catch (error) {
      console.error('Error checking for transcript:', error);
      // Set default state on error
      setTranscript('');
      setTranscriptExists(false);
      transcriptOpacity.value = 0;
      buttonOpacity.value = 1;
    }
  };

  useEffect(() => {
    console.log('📄 [ExpandedItemView] useEffect - item changed:', item?.title || 'null');
    if (item) {
      // Store the item for display
      setDisplayItem(item);
      setSelectedType(item.content_type);
      // Initialize selected spaces from item_spaces relationships
      const spaceIds = itemSpacesComputed.getSpaceIdsForItem(item.id);
      setSelectedSpaceIds(spaceIds);

      // Reset carousel index when opening a new item
      setCurrentImageIndex(0);

      // Reset video playing state for new item
      setIsVideoPlaying(false);

      // Debug: Check metadata store
      if (item.content_type === 'x') {
        const allMetadata = itemTypeMetadataComputed.typeMetadata();
        console.log('All type metadata in store:', allMetadata);
        const itemMetadata = itemTypeMetadataComputed.getTypeMetadataForItem(item.id);
        console.log('Metadata for this item:', itemMetadata);
      }

      // Initialize tags
      setTags(item.tags || []);
      setShowAllTags(false); // Reset to collapsed state when opening a new item

      // Check for existing transcript if YouTube video or short
      if (item.content_type === 'youtube' || item.content_type === 'youtube_short') {
        checkForExistingTranscript(item.id);
      }

      // Open the sheet after a small delay to ensure it's mounted
      console.log('📄 [ExpandedItemView] Scheduling sheet open');
      setTimeout(() => {
        console.log('📄 [ExpandedItemView] Opening sheet via ref, ref exists?', !!(ref && typeof ref !== 'function' && ref.current));
        if (ref && typeof ref !== 'function' && ref.current) {
          console.log('📄 [ExpandedItemView] Calling snapToIndex(0)');
          ref.current.snapToIndex(0);
        }
      }, 50);
    } else {
      // Close the sheet when item is cleared
      console.log('📄 [ExpandedItemView] Closing sheet');
      if (ref && typeof ref !== 'function' && ref.current) {
        ref.current.close();
      }
    }
  }, [item, ref]);


  // Use displayItem for rendering
  const itemToDisplay = displayItem || item;
  console.log('📄 [ExpandedItemView] Rendering - itemToDisplay:', itemToDisplay?.title || 'null');
  if (!itemToDisplay) {
    console.log('📄 [ExpandedItemView] Returning null - no item to display');
    return null;
  }

  const getContentTypeIcon = () => {
    switch (itemToDisplay?.content_type) {
      case 'youtube':
      case 'youtube_short': return '▶️';
      case 'x': return '𝕏';
      case 'instagram': return '📷';
      case 'podcast': return '🎙️';
      case 'github': return '⚡';
      case 'note': return '📝';
      case 'image': return '🖼️';
      case 'article':
      case 'bookmark': return '🔖';
      default: return '📎';
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
  
  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url?: string) => {
    if (!url) return null;
    
    // Remove any trailing parameters or fragments
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
        // console.log('YouTube Video ID extracted:', match[1], 'from URL:', url);
        return match[1];
      }
    }
    
    console.error('Failed to extract YouTube video ID from URL:', url);
    return null;
  };
  
  // Download thumbnail to device
  const generateTranscript = async () => {
    if (!itemToDisplay || (itemToDisplay.content_type !== 'youtube' && itemToDisplay.content_type !== 'youtube_short') || !itemToDisplay.url) return;

    setIsGeneratingTranscript(true);
    
    try {
      // Extract video ID from URL
      const videoIdMatch = itemToDisplay.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (!videoIdMatch) {
        throw new Error('Invalid YouTube URL');
      }
      const videoId = videoIdMatch[1];

      // Fetch transcript from YouTube
      const { transcript: fetchedTranscript, language } = await getYouTubeTranscript(videoId);
      
      // Create video transcript object
      console.log('Creating video transcript for item:', itemToDisplay.id);
      const transcriptData: VideoTranscript = {
        id: uuid.v4() as string,
        item_id: itemToDisplay.id,
        transcript: fetchedTranscript,
        platform: 'youtube', // Since this is YouTube content
        language,
        duration: itemToDisplay.duration,
        fetched_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Save to local store and sync to Supabase
      await videoTranscriptsActions.addTranscript(transcriptData);
      console.log('Transcript saved to local store and queued for sync');
      
      // Update local state
      setTranscript(fetchedTranscript);
      setTranscriptStats(calculateTranscriptStats(fetchedTranscript));
      setTranscriptExists(true);
      
      // Animate transition from button to dropdown
      buttonOpacity.value = withTiming(0, { duration: 150 }, () => {
        transcriptOpacity.value = withTiming(1, { duration: 150 });
      });
      
      // Auto-expand dropdown after generation
      setTimeout(() => {
        setShowTranscript(true);
        // Note: Auto-scroll to transcript removed for bottom sheet compatibility
      }, 300);
      
    } catch (error) {
      console.error('Error generating transcript:', error);
      alert('Failed to generate transcript. The video may not have captions available.');
    } finally {
      setIsGeneratingTranscript(false);
    }
  };

  const copyTranscriptToClipboard = async () => {
    if (transcript) {
      await Clipboard.setStringAsync(transcript);
      // Could add a toast notification here
    }
  };

  const downloadThumbnail = async () => {
    if (!itemToDisplay?.thumbnail_url) {
      Alert.alert('Error', 'No thumbnail to download');
      return;
    }
    
    try {
      setIsDownloading(true);
      
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Need permission to save images');
        return;
      }
      
      // Download the image
      const filename = `youtube_thumbnail_${Date.now()}.jpg`;
      const result = await FileSystem.downloadAsync(
        itemToDisplay.thumbnail_url,
        FileSystem.documentDirectory + filename
      );
      
      // Save to media library
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
      const { error } = await supabase
        .from('items')
        .update({ tags: tagsToSave })
        .eq('id', itemToDisplay.id);

      if (error) throw error;

      // Update the item in the store
      await itemsActions.updateItem(itemToDisplay.id, { tags: tagsToSave });

      // No alert needed for auto-save
      console.log('Tags auto-saved successfully');
    } catch (error) {
      console.error('Error saving tags:', error);
      // Only show error alert, not success
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
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        styles.sheetBackground,
        isDarkMode && styles.sheetBackgroundDark,
      ]}
      handleIndicatorStyle={[
        styles.handleIndicator,
        isDarkMode && styles.handleIndicatorDark,
      ]}
      onChange={(index) => {
        console.log('📄 [ExpandedItemView] onChange - index:', index);
        if (index === -1) {
          console.log('📄 [ExpandedItemView] Sheet closed - calling onClose');
          onClose?.();
        } else if (index >= 0) {
          console.log('📄 [ExpandedItemView] Sheet opened - calling onOpen');
          onOpen?.();
        }
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
                {/* Close Button - Always visible */}
                <TouchableOpacity
                  style={[styles.closeButton, { position: 'absolute', top: 16, right: 16, zIndex: 1000 }]}
                  onPress={() => onClose?.()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>

                {/* Hero Image/Video - Skip for X posts without media */}
                {(() => {
                  // Check if this is an X post without media
                  const imageUrls = itemTypeMetadataComputed.getImageUrls(itemToDisplay?.id || '');
                  const isXPostWithoutMedia = itemToDisplay?.content_type === 'x' &&
                                               !videoUrl &&
                                               (!imageUrls || imageUrls.length === 0);

                  if (isXPostWithoutMedia) {
                    return null; // Skip hero section for text-only X posts
                  }

                  return (
                    <View style={styles.heroContainer}>
                  {(itemToDisplay?.content_type === 'youtube' || itemToDisplay?.content_type === 'youtube_short') && getYouTubeVideoId(itemToDisplay?.url) ? (
                    // YouTube video embed (different aspect ratios for regular vs shorts)
                    <View style={itemToDisplay?.content_type === 'youtube_short' ? styles.youtubeShortEmbed : styles.youtubeEmbed}>
                      <WebView
                        source={{
                          uri: `https://www.youtube-nocookie.com/embed/${getYouTubeVideoId(itemToDisplay.url)}?rel=0&modestbranding=1&playsinline=1`
                        }}
                        style={styles.webView}
                        allowsFullscreenVideo={true}
                        allowsInlineMediaPlayback={true}
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        mixedContentMode="compatibility"
                        originWhitelist={['*']}
                        userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
                        onError={(syntheticEvent) => {
                          const { nativeEvent } = syntheticEvent;
                          console.error('WebView error:', nativeEvent);
                          console.log('Failed URL:', `https://www.youtube-nocookie.com/embed/${getYouTubeVideoId(itemToDisplay.url)}`);
                          console.log('Video ID:', getYouTubeVideoId(itemToDisplay.url));
                        }}
                        onHttpError={(syntheticEvent) => {
                          const { nativeEvent } = syntheticEvent;
                          console.error('HTTP error:', nativeEvent.statusCode, nativeEvent.description);
                        }}
                      />
                    </View>
                  ) : videoUrl && videoPlayer ? (
                    // Show video player for Twitter/X videos
                    <View style={{ position: 'relative' }}>
                      <VideoView
                        player={videoPlayer}
                        style={[
                          styles.heroMedia,
                          { height: SCREEN_WIDTH / (16/9) } // Set aspect ratio for videos
                        ]}
                        contentFit="contain"
                        allowsFullscreen={true}
                        showsTimecodes={true}
                        nativeControls={true}
                      />
                      {/* Play button overlay for X posts */}
                      {itemToDisplay?.content_type === 'x' && !isVideoPlaying && (
                        <TouchableOpacity
                          style={styles.videoPlayButtonOverlay}
                          onPress={() => {
                            if (videoPlayer) {
                              videoPlayer.play();
                              setIsVideoPlaying(true);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.videoPlayButton}>
                            <Text style={styles.videoPlayButtonIcon}>▶</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (() => {
                    const imageUrls = itemTypeMetadataComputed.getImageUrls(itemToDisplay?.id || '');
                    const hasMultipleImages = imageUrls && imageUrls.length > 1;
                    
                    if (hasMultipleImages) {
                      return (
                        // Show carousel for multiple images
                        <View style={{ position: 'relative', width: SCREEN_WIDTH, height: SCREEN_WIDTH }}>
                          <ScrollView
                            ref={scrollViewRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            nestedScrollEnabled={true}
                            directionalLockEnabled={true}
                            onMomentumScrollEnd={(event) => {
                              const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                              setCurrentImageIndex(newIndex);
                            }}
                            scrollEventThrottle={16}
                            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                            contentContainerStyle={{ height: SCREEN_WIDTH }}
                          >
                            {imageUrls!.map((imageUrl, index) => (
                              <Image
                                key={index}
                                source={{ uri: imageUrl }}
                                style={{
                                  width: SCREEN_WIDTH,
                                  height: SCREEN_WIDTH,
                                  backgroundColor: '#000000'
                                }}
                                resizeMode="contain"
                              />
                            ))}
                          </ScrollView>
                          {/* Dots indicator */}
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
                      );
                    } else if (imageUrls && imageUrls.length === 1) {
                      // Single image from X post
                      return (
                        <Image
                          source={{ uri: imageUrls[0] }}
                          style={[
                            styles.heroMedia,
                            imageAspectRatio ? {
                              width: SCREEN_WIDTH,
                              height: SCREEN_WIDTH / imageAspectRatio,
                              maxHeight: SCREEN_HEIGHT * 0.6
                            } : {}
                          ]}
                          resizeMode="contain"
                          onLoad={(e: any) => {
                            // Dynamically adjust height based on image aspect ratio
                            if (e.source && e.source.width && e.source.height) {
                              const ratio = e.source.width / e.source.height;
                              setImageAspectRatio(ratio);
                            }
                          }}
                        />
                      );
                    }
                    return null;
                  })() || (itemToDisplay?.thumbnail_url && itemToDisplay?.content_type !== 'x' ? (
                    // Show image for non-video, non-X items
                    <Image
                      source={{ uri: itemToDisplay.thumbnail_url }}
                      style={[
                        styles.heroMedia,
                        imageAspectRatio ? {
                          width: SCREEN_WIDTH,
                          height: SCREEN_WIDTH / imageAspectRatio,
                          maxHeight: SCREEN_HEIGHT * 0.6
                        } : {}
                      ]}
                      resizeMode="contain"
                      onLoad={(e: any) => {
                        // Dynamically adjust height based on image aspect ratio
                        if (e.source && e.source.width && e.source.height) {
                          const ratio = e.source.width / e.source.height;
                          setImageAspectRatio(ratio);
                        }
                      }}
                    />
                  ) : itemToDisplay?.content_type !== 'x' ? (
                    // Placeholder when no media (but not for X posts)
                    <View style={[styles.placeholderHero, isDarkMode && styles.placeholderHeroDark]}>
                      <Text style={styles.placeholderIcon}>{getContentTypeIcon()}</Text>
                    </View>
                  ) : null)}
                </View>
                  );
                })()}

                {/* Content */}
                <View style={styles.content}>
                  {/* Title and Metadata */}
                  <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                    {itemToDisplay?.title}
                  </Text>

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

                  {/* Description */}
                  {itemToDisplay?.desc && (
                    <View style={styles.descriptionSection}>
                      <Text style={[styles.descriptionSectionLabel, isDarkMode && styles.descriptionSectionLabelDark]}>
                        DESCRIPTION
                      </Text>
                      <TouchableOpacity
                        style={[styles.descriptionContainer, isDarkMode && styles.descriptionContainerDark]}
                        onPress={() => setExpandedDescription(!expandedDescription)}
                        activeOpacity={0.7}
                      >
                        <Text 
                          style={[styles.descriptionText, isDarkMode && styles.descriptionTextDark]} 
                          numberOfLines={expandedDescription ? undefined : 6}
                        >
                          {itemToDisplay.desc}
                        </Text>
                        {(!expandedDescription && itemToDisplay.desc.length > 300) && (
                          <Text style={[styles.expandToggle, isDarkMode && styles.expandToggleDark]}>
                            Show more ▼
                          </Text>
                        )}
                        {expandedDescription && (
                          <Text style={[styles.expandToggle, isDarkMode && styles.expandToggleDark]}>
                            Show less ▲
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Tags Section */}
                  <View style={styles.tagsSection}>
                    <View style={styles.tagsSectionHeader}>
                      <Text style={[styles.tagsSectionLabel, isDarkMode && styles.tagsSectionLabelDark]}>
                        TAGS
                      </Text>
                      <TouchableOpacity
                        style={[styles.aiButton, isDarkMode && styles.aiButtonDark]}
                        onPress={generateAITags}
                        disabled={isGeneratingTags}
                      >
                        <Text style={[styles.aiButtonText, isDarkMode && styles.aiButtonTextDark]}>
                          {isGeneratingTags ? 'Generating...' : '✨ AI Generate'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Tags Display */}
                    <View style={styles.tagsContainer}>
                      {/* Show tags based on count and expanded state */}
                      {(() => {
                        if (tags.length <= 5) {
                          // Show all tags if 5 or fewer
                          return tags.map((tag, index) => (
                            <View key={index} style={[styles.tagChip, isDarkMode && styles.tagChipDark]}>
                              <Text style={[styles.tagText, isDarkMode && styles.tagTextDark]}>
                                {tag}
                              </Text>
                              <TouchableOpacity
                                onPress={() => removeTag(tag)}
                                style={styles.tagRemoveButton}
                              >
                                <Text style={[styles.tagRemoveText, isDarkMode && styles.tagRemoveTextDark]}>×</Text>
                              </TouchableOpacity>
                            </View>
                          ));
                        } else if (showAllTags) {
                          // Show all tags when expanded
                          return tags.map((tag, index) => (
                            <View key={index} style={[styles.tagChip, isDarkMode && styles.tagChipDark]}>
                              <Text style={[styles.tagText, isDarkMode && styles.tagTextDark]}>
                                {tag}
                              </Text>
                              <TouchableOpacity
                                onPress={() => removeTag(tag)}
                                style={styles.tagRemoveButton}
                              >
                                <Text style={[styles.tagRemoveText, isDarkMode && styles.tagRemoveTextDark]}>×</Text>
                              </TouchableOpacity>
                            </View>
                          ));
                        } else {
                          // Show only first 4 tags when collapsed and more than 5 total
                          return tags.slice(0, 4).map((tag, index) => (
                            <View key={index} style={[styles.tagChip, isDarkMode && styles.tagChipDark]}>
                              <Text style={[styles.tagText, isDarkMode && styles.tagTextDark]}>
                                {tag}
                              </Text>
                              <TouchableOpacity
                                onPress={() => removeTag(tag)}
                                style={styles.tagRemoveButton}
                              >
                                <Text style={[styles.tagRemoveText, isDarkMode && styles.tagRemoveTextDark]}>×</Text>
                              </TouchableOpacity>
                            </View>
                          ));
                        }
                      })()}
                      
                      {/* Show more/less button if there are more than 5 tags */}
                      {tags.length > 5 && (
                        <TouchableOpacity
                          style={[styles.showMoreButton, isDarkMode && styles.showMoreButtonDark]}
                          onPress={() => setShowAllTags(!showAllTags)}
                        >
                          <Text style={[styles.showMoreText, isDarkMode && styles.showMoreTextDark]}>
                            {showAllTags ? '− Show Less' : `+${tags.length - 4} More`}
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      {/* Add Tag Input */}
                      {showTagInput ? (
                        <View style={[styles.tagInputContainer, isDarkMode && styles.tagInputContainerDark]}>
                          <TextInput
                            style={[styles.tagInput, isDarkMode && styles.tagInputDark]}
                            value={tagInput}
                            onChangeText={setTagInput}
                            onSubmitEditing={addTag}
                            placeholder="Add tag..."
                            placeholderTextColor={isDarkMode ? '#666' : '#999'}
                            autoFocus
                            onBlur={() => {
                              if (!tagInput.trim()) {
                                setShowTagInput(false);
                              }
                            }}
                          />
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.addTagButton, isDarkMode && styles.addTagButtonDark]}
                          onPress={() => setShowTagInput(true)}
                        >
                          <Text style={[styles.addTagButtonText, isDarkMode && styles.addTagButtonTextDark]}>
                            + Add Tag
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Full Content */}
                  {itemToDisplay?.content && (
                    <View style={styles.fullContent}>
                      <Text style={[styles.contentText, isDarkMode && styles.contentTextDark]}>
                        {itemToDisplay.content}
                      </Text>
                    </View>
                  )}

                  {/* Raw Text (for articles) */}
                  {itemToDisplay?.raw_text && (
                    <View style={styles.fullContent}>
                      <Text style={[styles.contentText, isDarkMode && styles.contentTextDark]}>
                        {itemToDisplay.raw_text}
                      </Text>
                    </View>
                  )}

                  {/* Space Selector */}
                  <View style={styles.spaceSection}>
                    <Text style={[styles.spaceSectionLabel, isDarkMode && styles.spaceSectionLabelDark]}>
                      SPACES
                    </Text>
                    <TouchableOpacity
                      style={[styles.spaceSelector, isDarkMode && styles.spaceSelectorDark]}
                      onPress={() => {
                        setShowSpaceSelector(!showSpaceSelector);
                        setShowTypeSelector(false); // Close type selector if open
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

                    {/* Space Options */}
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
                              
                              // Update the item with new space assignments
                              if (itemToDisplay) {
                                const currentSpaceIds = itemSpacesComputed.getSpaceIdsForItem(itemToDisplay.id);
                                
                                // Add new space relationships
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
                                
                                // Remove old space relationships
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
                              // Update item to remove from all spaces
                              if (itemToDisplay) {
                                const currentSpaceIds = itemSpacesComputed.getSpaceIdsForItem(itemToDisplay.id);
                                
                                // Remove all space relationships
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
                        setShowSpaceSelector(false); // Close space selector if open
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

                    {/* Type Options */}
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

                  {/* Thumbnail Section (for YouTube and YouTube Shorts) */}
                  {(itemToDisplay?.content_type === 'youtube' || itemToDisplay?.content_type === 'youtube_short') && itemToDisplay?.thumbnail_url && (
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
                          <Image
                            source={{ uri: itemToDisplay.thumbnail_url }}
                            style={styles.thumbnailImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={[styles.thumbnailDownloadButton, isDownloading && styles.thumbnailDownloadButtonDisabled]}
                            onPress={downloadThumbnail}
                            disabled={isDownloading}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.thumbnailDownloadButtonText}>
                              {isDownloading ? '⏳ Downloading...' : '💾 Save to Device'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Transcript Section (for YouTube and YouTube Shorts) */}
                  {(itemToDisplay?.content_type === 'youtube' || itemToDisplay?.content_type === 'youtube_short') && (
                    <View 
                      style={styles.transcriptSection}
                      onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        setTranscriptSectionY(y);
                      }}
                    >
                      <Text style={[styles.transcriptSectionLabel, isDarkMode && styles.transcriptSectionLabelDark]}>
                        TRANSCRIPT
                      </Text>
                      
                      {/* Show button or dropdown based on transcript existence */}
                      {!transcriptExists ? (
                        <Animated.View style={{ opacity: buttonOpacity }}>
                          <TouchableOpacity
                            style={[
                              styles.transcriptGenerateButton,
                              isGeneratingTranscript && styles.transcriptGenerateButtonDisabled,
                              isDarkMode && styles.transcriptGenerateButtonDark
                            ]}
                            onPress={generateTranscript}
                            disabled={isGeneratingTranscript}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.transcriptGenerateButtonText}>
                              {isGeneratingTranscript ? '⏳ Processing...' : '⚡ Generate'}
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
                              
                              {/* Sticky Footer with Stats */}
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

                  {/* Bottom Padding */}
                  <View style={{ height: 40 }} />
                </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}));

export default ExpandedItemView;

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
  scrollContent: {
    paddingBottom: 120,
  },
  heroContainer: {
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  heroImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#F0F0F0',
  },
  heroMedia: {
    width: SCREEN_WIDTH,
    minHeight: 250,
    maxHeight: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#000000',
  },
  placeholderHero: {
    width: '100%',
    height: 250,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderHeroDark: {
    backgroundColor: '#2C2C2E',
  },
  placeholderIcon: {
    fontSize: 64,
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
  spaceName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  spaceNameDark: {
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
  spaceOptionSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
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
  // Type Selector Styles
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
  // YouTube embed styles
  youtubeEmbed: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9/16), // 16:9 aspect ratio for regular videos
    backgroundColor: '#000',
  },
  youtubeShortEmbed: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (16/9), // 9:16 aspect ratio for YouTube Shorts (vertical)
    backgroundColor: '#000',
    maxHeight: SCREEN_HEIGHT * 0.8, // Limit max height to 70% of screen
  },
  webView: {
    flex: 1,
  },
  // Thumbnail section styles
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
  // Transcript section styles
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
    paddingBottom: 35, // Make room for sticky footer
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
    marginLeft: 5, // Slight offset to center the triangle
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
  aiButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  aiButtonDark: {
    backgroundColor: '#0A84FF',
  },
  aiButtonText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  aiButtonTextDark: {
    color: '#FFF',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipDark: {
    backgroundColor: '#2C2C2E',
  },
  tagText: {
    fontSize: 14,
    color: '#333',
  },
  tagTextDark: {
    color: '#FFF',
  },
  tagRemoveButton: {
    marginLeft: 6,
  },
  tagRemoveText: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
  },
  tagRemoveTextDark: {
    color: '#666',
  },
  addTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  addTagButtonDark: {
    borderColor: '#3C3C3E',
  },
  addTagButtonText: {
    fontSize: 14,
    color: '#666',
  },
  addTagButtonTextDark: {
    color: '#999',
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    minWidth: 100,
  },
  tagInputContainerDark: {
    backgroundColor: '#2C2C2E',
  },
  tagInput: {
    fontSize: 14,
    color: '#333',
    padding: 0,
    minWidth: 80,
  },
  tagInputDark: {
    color: '#FFF',
  },
  showMoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#007AFF',
  },
  showMoreButtonDark: {
    backgroundColor: '#0A84FF',
  },
  showMoreText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  showMoreTextDark: {
    color: '#FFF',
  },
});