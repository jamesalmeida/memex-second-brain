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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../../contexts/ToastContext';
import { videoTranscriptsActions, videoTranscriptsComputed } from '../../stores/videoTranscripts';
import Animated, {
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { observer, useObservable } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemsStore, itemsActions } from '../../stores/items';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { itemMetadataComputed } from '../../stores/itemMetadata';
import { adminSettingsStore } from '../../stores/adminSettings';
import { Item, ContentType } from '../../types';
import { generateTags, URLMetadata } from '../../services/urlMetadata';
import TagsEditor from '../TagsEditor';
import { ItemViewHeader, ItemViewTldr, ItemViewNotes, ItemViewFooter } from './components';
import InlineEditableText from '../InlineEditableText';
import { HeroMediaSection } from './components';
import ImageUploadModal, { ImageUploadModalHandle } from '../ImageUploadModal';
import SpaceSelectorModal from '../SpaceSelectorModal';
import ContentTypeSelectorModal from '../ContentTypeSelectorModal';
import AudioPlayer from '../AudioPlayer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTENT_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - (CONTENT_PADDING * 2);

const contentTypeOptions: { type: ContentType; label: string; icon: string }[] = [
  { type: 'bookmark', label: 'Bookmark', icon: '🔖' },
  { type: 'note', label: 'Note', icon: '📝' },
  { type: 'youtube', label: 'YouTube', icon: '▶️' },
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

interface PodcastItemViewProps {
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

const PodcastItemView = observer(({
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
}: PodcastItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const showDescription = adminSettingsStore.settings.ui_show_description.get() ?? false;
  const { showToast } = useToast();
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(currentSpaceId || null);
  const [displayItem, setDisplayItem] = useState<Item | null>(null);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedType, setSelectedType] = useState(item?.content_type || 'podcast');
  const [transcript, setTranscript] = useState<string>('');
  const [transcriptSegments, setTranscriptSegments] = useState<Array<{ startMs: number; endMs?: number; text: string }> | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [transcriptExists, setTranscriptExists] = useState(false);
  const [transcriptStats, setTranscriptStats] = useState({ chars: 0, words: 0, readTime: 0 });
  const transcriptOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(1);

  const [tags, setTags] = useState<string[]>([]);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const imageUploadModalRef = useRef<ImageUploadModalHandle>(null);

  useEffect(() => {
    console.log('📄 [PodcastItemView] useEffect - item changed:', item?.title || 'null');
    if (item) {
      const latestItem = itemsStore.items.get().find(i => i.id === item.id) || item;

      setDisplayItem(latestItem);
      setSelectedType(latestItem.content_type);
      setSelectedSpaceId(latestItem.space_id || null);

      setTags(latestItem.tags || []);

      // Check for existing transcript
      if (latestItem.content_type === 'podcast' || latestItem.content_type === 'podcast_episode') {
        checkForExistingTranscript(latestItem.id);
      }
    }
  }, [item]);

  // Watch items store for updates to the current item
  useEffect(() => {
    if (item?.id) {
      const latestItem = itemsStore.items.get().find(i => i.id === item.id);
      if (latestItem && latestItem.space_id !== selectedSpaceId) {
        console.log('📄 [PodcastItemView] Item space_id changed in store, updating UI');
        setSelectedSpaceId(latestItem.space_id || null);
        setDisplayItem(latestItem);
      }
    }
  }, [item?.id, itemsStore.items.get()]);

  // Watch for changes in transcript store
  useEffect(() => {
    if (itemToDisplay) {
      const existingTranscript = videoTranscriptsComputed.getTranscriptByItemId(itemToDisplay.id);

      if (existingTranscript) {
        console.log('📄 [PodcastItemView] Transcript detected in store');
        setTranscript(existingTranscript.transcript);
        setTranscriptSegments(existingTranscript.segments || null);
        setTranscriptExists(true);

        // Calculate transcript stats
        const chars = existingTranscript.transcript.length;
        const words = existingTranscript.transcript.split(/\s+/).length;
        const readTime = Math.ceil(words / 200); // Assume 200 words per minute reading speed
        setTranscriptStats({ chars, words, readTime });

        // Animate transition from button to dropdown
        buttonOpacity.value = withTiming(0, { duration: 150 }, () => {
          transcriptOpacity.value = withTiming(1, { duration: 150 });
        });
      } else {
        // Reset to button state if transcript was removed
        setTranscript('');
        setTranscriptSegments(null);
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

  // Get audio URL and episode status from type metadata
  const typeMetadata = itemTypeMetadataComputed.getTypeMetadataForItem(itemToDisplay.id);
  const audioUrl = typeMetadata?.data?.audio_url;
  const isEpisode = typeMetadata?.data?.is_episode !== false; // Default to true if not specified
  const duration = typeMetadata?.data?.duration;
  const episodeNumber = typeMetadata?.data?.episode_number;
  const seasonNumber = typeMetadata?.data?.season_number;

  // Get author and published date
  const metadata = itemMetadataComputed.getMetadataForItem(itemToDisplay.id);
  const author = metadata?.author;
  const publishedDate = metadata?.published_date;

  const checkForExistingTranscript = async (itemId: string) => {
    try {
      console.log('Checking for existing podcast transcript for item:', itemId);

      const existingTranscript = videoTranscriptsComputed.getTranscriptByItemId(itemId);

      if (existingTranscript) {
        console.log('Found podcast transcript in local store');
        setTranscript(existingTranscript.transcript);
        setTranscriptSegments(existingTranscript.segments || null);
        setTranscriptExists(true);

        // Calculate stats
        const chars = existingTranscript.transcript.length;
        const words = existingTranscript.transcript.split(/\s+/).length;
        const readTime = Math.ceil(words / 200);
        setTranscriptStats({ chars, words, readTime });

        transcriptOpacity.value = 1;
        buttonOpacity.value = 0;
        return;
      }

      console.log('No existing podcast transcript found for item:', itemId);
      setTranscript('');
      setTranscriptSegments(null);
      setTranscriptExists(false);
      transcriptOpacity.value = 0;
      buttonOpacity.value = 1;
    } catch (error) {
      console.error('Error checking for podcast transcript:', error);
      setTranscript('');
      setTranscriptSegments(null);
      setTranscriptExists(false);
      transcriptOpacity.value = 0;
      buttonOpacity.value = 1;
    }
  };

  const generateTranscript = async () => {
    if (!itemToDisplay || !audioUrl) {
      Alert.alert('Error', 'No audio URL available for transcription');
      return;
    }

    setIsGeneratingTranscript(true);
    videoTranscriptsActions.setGenerating(itemToDisplay.id, true);

    try {
      console.log('🎙️ Generating transcript for podcast episode');

      const result = await itemsActions.generatePodcastTranscript(itemToDisplay.id);

      if (result) {
        setTranscript(result.transcript);
        setTranscriptSegments(result.segments || null);
        setTranscriptExists(true);

        // Calculate stats
        const chars = result.transcript.length;
        const words = result.transcript.split(/\s+/).length;
        const readTime = Math.ceil(words / 200);
        setTranscriptStats({ chars, words, readTime });

        // Animate transition from button to dropdown
        buttonOpacity.value = withTiming(0, { duration: 150 }, () => {
          transcriptOpacity.value = withTiming(1, { duration: 150 });
        });

        // Auto-expand dropdown after generation
        setTimeout(() => {
          setShowTranscript(true);
        }, 300);

        showToast({ message: 'Transcript generated successfully', type: 'success' });
      } else {
        Alert.alert('Error', 'Failed to generate transcript');
      }
    } catch (error) {
      console.error('Error generating podcast transcript:', error);
      Alert.alert('Error', 'Failed to generate transcript. Please try again.');
    } finally {
      setIsGeneratingTranscript(false);
      videoTranscriptsActions.setGenerating(itemToDisplay.id, false);
    }
  };

  const copyTranscriptToClipboard = async () => {
    if (transcript) {
      await Clipboard.setStringAsync(transcript);
      showToast({ message: 'Transcript copied to clipboard', type: 'success' });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

  const saveTagsToDatabase = async (tagsToSave: string[]) => {
    if (!itemToDisplay) return;

    try {
      await itemsActions.updateItemWithSync(itemToDisplay.id, { tags: tagsToSave });
      console.log('Tags auto-saved successfully');
    } catch (error) {
      console.error('Error saving tags:', error);
      Alert.alert('Error', 'Failed to save tags');
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

  const handleImageRemove = async () => {
    if (!itemToDisplay) return;

    try {
      await itemsActions.removeItemImage(itemToDisplay.id);
      setDisplayItem({ ...itemToDisplay, thumbnail_url: null });
      showToast({ message: 'Image removed successfully', type: 'success' });
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
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
          if (!itemToDisplay) return;
          await itemsActions.updateItemWithSync(itemToDisplay.id, { title: newTitle });
          setDisplayItem({ ...(itemToDisplay as Item), title: newTitle });
        }}
        onClose={() => onClose?.()}
        isDarkMode={isDarkMode}
        placeholder="Episode Title"
        hasImage={hasImage}
        onAddImage={() => imageUploadModalRef.current?.open()}
        onChangeContentType={() => setShowTypeModal(true)}
        onMoveToSpace={() => setShowSpaceModal(true)}
        onRefresh={handleRefreshMetadata}
        onShare={() => onShare?.(itemToDisplay)}
        onArchive={() => onArchive?.(itemToDisplay)}
        onUnarchive={() => onUnarchive?.(itemToDisplay)}
        onDelete={() => onDelete?.(itemToDisplay)}
        item={itemToDisplay}
      />

      {/* Hero Media Section (for podcast artwork/thumbnail) */}
      <HeroMediaSection
        item={itemToDisplay!}
        isDarkMode={isDarkMode}
        contentTypeIcon="🎙️"
        onImageAdd={() => imageUploadModalRef.current?.open()}
        onImageRemove={handleMetadataImageRemove}
        onThumbnailRemove={handleImageRemove}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Audio Player - Only show if this is a specific episode with audio URL */}
        {isEpisode && audioUrl ? (
          <AudioPlayer itemId={itemToDisplay.id} audioUrl={audioUrl} isDarkMode={isDarkMode} />
        ) : isEpisode ? (
          <View style={[styles.noAudioNotice, isDarkMode && styles.noAudioNoticeDark]}>
            <Text style={[styles.noAudioText, isDarkMode && styles.noAudioTextDark]}>
              No audio URL found for this episode. Transcription unavailable.
            </Text>
          </View>
        ) : null}

        <View style={styles.metadata}>
          {/* Episode/Season Numbers */}
          {(seasonNumber || episodeNumber) && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
                {seasonNumber && `S${seasonNumber}`}
                {seasonNumber && episodeNumber && ' • '}
                {episodeNumber && `E${episodeNumber}`}
              </Text>
            </View>
          )}

          {/* Duration */}
          {duration && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
                {formatDuration(duration)}
              </Text>
            </View>
          )}

          {/* Author */}
          {author && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
                {author}
              </Text>
            </View>
          )}

          {/* Published Date */}
          {publishedDate && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
                {new Date(publishedDate).toLocaleDateString()}
              </Text>
            </View>
          )}

          {/* Domain */}
          {getDomain() && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, isDarkMode && styles.metaLabelDark]}>
                {getDomain()}
              </Text>
            </View>
          )}
        </View>

        {/* Description - Only visible if admin toggle is enabled */}
        {showDescription && (
          <View style={styles.descriptionSection}>
            <Text style={[styles.descriptionSectionLabel, isDarkMode && styles.descriptionSectionLabelDark]}>
              DESCRIPTION
            </Text>
            <InlineEditableText
              value={itemToDisplay?.desc || ''}
              placeholder="Tap to add description"
              onSave={async (newDesc) => {
                if (!itemToDisplay) return;
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
        )}

        {/* TLDR Section */}
        <ItemViewTldr
          item={itemToDisplay}
          isDarkMode={isDarkMode}
          onTldrChange={(newTldr) => {
            setDisplayItem({ ...itemToDisplay, tldr: newTldr });
          }}
        />

        {/* Transcript Section */}
        {isEpisode && audioUrl && (
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
                    {(isGeneratingTranscript || videoTranscriptsComputed.isGenerating(itemToDisplay?.id || '')) ? '⏳ Generating...' : '⚡ Generate Transcript'}
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
                    {showTranscript ? 'Hide Transcript' : `View Transcript (${transcriptStats.words} words • ${transcriptStats.readTime} min read)`}
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
                        {transcriptStats.chars.toLocaleString()} characters • {transcriptStats.words.toLocaleString()} words
                      </Text>
                    </View>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}

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
                {contentTypeOptions.find(t => t.type === selectedType)?.icon || '🎙️'}
              </Text>
              <Text style={[styles.typeName, isDarkMode && styles.typeNameDark]}>
                {contentTypeOptions.find(t => t.type === selectedType)?.label || 'Podcast'}
              </Text>
            </View>
            <Text style={styles.chevron}>▼</Text>
          </TouchableOpacity>
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

      {/* Image Upload Modal */}
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

export default PodcastItemView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
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
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  descriptionTextDark: {
    color: '#CCC',
  },
  notEpisodeNotice: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  notEpisodeNoticeDark: {
    backgroundColor: '#3A3A00',
    borderColor: '#6B6B00',
  },
  notEpisodeText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  notEpisodeTextDark: {
    color: '#FFD700',
  },
  noAudioNotice: {
    backgroundColor: '#F8D7DA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  noAudioNoticeDark: {
    backgroundColor: '#3A1F20',
    borderColor: '#6B3A3C',
  },
  noAudioText: {
    fontSize: 14,
    color: '#721C24',
    textAlign: 'center',
  },
  noAudioTextDark: {
    color: '#F8D7DA',
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
  chevron: {
    fontSize: 12,
    color: '#666',
  },
  chevronDark: {
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
});
