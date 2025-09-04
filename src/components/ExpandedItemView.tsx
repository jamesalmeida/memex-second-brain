import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  StatusBar,
  Platform,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../stores/theme';
import { Item, Space, ContentType } from '../types';
import { generateMockSpaces } from '../utils/mockData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const contentTypeOptions: { type: ContentType; label: string; icon: string }[] = [
  { type: 'bookmark', label: 'Bookmark', icon: '🔖' },
  { type: 'note', label: 'Note', icon: '📝' },
  { type: 'youtube', label: 'YouTube', icon: '▶️' },
  { type: 'x', label: 'X/Twitter', icon: '𝕏' },
  { type: 'github', label: 'GitHub', icon: '⚡' },
  { type: 'article', label: 'Article', icon: '📄' },
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'video', label: 'Video', icon: '🎥' },
  { type: 'audio', label: 'Audio', icon: '🎵' },
  { type: 'pdf', label: 'PDF', icon: '📑' },
  { type: 'product', label: 'Product', icon: '🛍️' },
];

interface ExpandedItemViewProps {
  item: Item | null;
  isVisible: boolean;
  cardPosition?: { x: number; y: number; width: number; height: number };
  onClose: () => void;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  onSpaceChange?: (item: Item, spaceId: string | null) => void;
  currentSpaceId?: string | null;
}

const ExpandedItemView = observer(({
  item,
  isVisible,
  cardPosition,
  onClose,
  onChat,
  onEdit,
  onArchive,
  onDelete,
  onShare,
  onSpaceChange,
  currentSpaceId,
}: ExpandedItemViewProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const animationProgress = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(currentSpaceId || null);
  const [spaces] = useState<Space[]>(generateMockSpaces());
  const [modalVisible, setModalVisible] = useState(false);
  const [displayItem, setDisplayItem] = useState<Item | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState(item?.content_type || 'bookmark');
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Set up video player if item has video
  const videoPlayer = useVideoPlayer(displayItem?.video_url ? displayItem.video_url : null, player => {
    if (player && displayItem?.video_url) {
      player.loop = true;
      player.muted = false; // Allow sound in expanded view
      player.play();
    }
  });

  useEffect(() => {
    if (isVisible && item) {
      // Store the item for display
      setDisplayItem(item);
      setSelectedType(item.content_type);
      // Show modal first, then animate in
      setModalVisible(true);
      setTimeout(() => {
        animationProgress.value = withSpring(1, {
          damping: 15,
          stiffness: 150,
          mass: 0.8,
        });
        opacity.value = withTiming(1, { duration: 150 });
      }, 50);
    } else if (!isVisible && modalVisible) {
      // Animate out first, then hide modal
      // Keep displayItem during animation
      animationProgress.value = withSpring(0, {
        damping: 18,
        stiffness: 120,
      }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setModalVisible)(false);
          runOnJS(setDisplayItem)(null);
        }
      });
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [isVisible, item]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      if (translateY.value > 100) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const containerStyle = useAnimatedStyle(() => {
    const initialX = cardPosition?.x || SCREEN_WIDTH / 2;
    const initialY = cardPosition?.y || SCREEN_HEIGHT / 2;
    const initialWidth = cardPosition?.width || 100;
    const initialHeight = cardPosition?.height || 100;

    // Account for safe area insets
    const finalY = insets.top;
    const finalHeight = SCREEN_HEIGHT - insets.top - insets.bottom;

    const x = interpolate(
      animationProgress.value,
      [0, 1],
      [initialX, 0]
    );
    const y = interpolate(
      animationProgress.value,
      [0, 1],
      [initialY, finalY]
    );
    const width = interpolate(
      animationProgress.value,
      [0, 1],
      [initialWidth, SCREEN_WIDTH]
    );
    const height = interpolate(
      animationProgress.value,
      [0, 1],
      [initialHeight, finalHeight]
    );

    return {
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.9,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Use displayItem which persists during closing animation
  if (!displayItem && !modalVisible) return null;
  
  const itemToDisplay = displayItem || item;

  const getContentTypeIcon = () => {
    switch (itemToDisplay?.content_type) {
      case 'youtube': return '▶️';
      case 'x': return '𝕏';
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

  const getDomain = () => {
    if (!itemToDisplay?.url) return null;
    try {
      const url = new URL(itemToDisplay.url);
      return url.hostname.replace('www.', '');
    } catch {
      return null;
    }
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            isDarkMode && styles.backdropDark,
            backdropStyle,
          ]}
        />

        {/* Expanded Card */}
        <GestureDetector gesture={pan}>
          <Animated.View style={[containerStyle]}>
            <View style={[styles.container, isDarkMode && styles.containerDark]}>
              <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={true}
              >

              <Animated.View style={[contentStyle]}>
                {/* Hero Image/Video with Close Button Overlay */}
                <View style={styles.heroContainer}>
                  {itemToDisplay?.video_url && videoPlayer ? (
                    // Show video player for Twitter/X videos
                    <VideoView
                      player={videoPlayer}
                      style={[
                        styles.heroMedia,
                        { height: SCREEN_WIDTH / (16/9) } // Set aspect ratio for videos
                      ]}
                      contentFit="contain"
                      allowsFullscreen={true}
                      showsTimecodes={true}
                    />
                  ) : itemToDisplay?.image_urls && itemToDisplay.image_urls.length > 1 ? (
                    // Show carousel for multiple images
                    <View style={{ position: 'relative' }}>
                      <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(event) => {
                          const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                          setCurrentImageIndex(newIndex);
                        }}
                        scrollEventThrottle={16}
                      >
                        {itemToDisplay.image_urls.map((imageUrl, index) => (
                          <Image
                            key={index}
                            source={{ uri: imageUrl }}
                            style={[
                              styles.heroMedia,
                              { width: SCREEN_WIDTH }
                            ]}
                            resizeMode="contain"
                          />
                        ))}
                      </ScrollView>
                      {/* Dots indicator */}
                      <View style={styles.dotsContainer}>
                        {itemToDisplay.image_urls.map((_, index) => (
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
                  ) : itemToDisplay?.thumbnail_url ? (
                    // Show image for non-video items
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
                  ) : (
                    // Placeholder when no media
                    <View style={[styles.placeholderHero, isDarkMode && styles.placeholderHeroDark]}>
                      <Text style={styles.placeholderIcon}>{getContentTypeIcon()}</Text>
                    </View>
                  )}
                  
                  {/* Close Button Overlay */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

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

                  {/* URL Display */}
                  {itemToDisplay?.url && (
                    <TouchableOpacity
                      style={[styles.urlContainer, isDarkMode && styles.urlContainerDark]}
                      onPress={async () => {
                        if (itemToDisplay?.url) {
                          await Clipboard.setStringAsync(itemToDisplay.url);
                          Alert.alert('Link Copied', 'The URL has been copied to your clipboard');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.urlLabel, isDarkMode && styles.urlLabelDark]}>
                        URL
                      </Text>
                      <Text style={[styles.urlText, isDarkMode && styles.urlTextDark]} numberOfLines={1}>
                        {itemToDisplay.url}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Description */}
                  {itemToDisplay?.desc && (
                    <Text style={[styles.description, isDarkMode && styles.descriptionDark]}>
                      {itemToDisplay.desc}
                    </Text>
                  )}

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
                      Space
                    </Text>
                    <TouchableOpacity
                      style={[styles.spaceSelector, isDarkMode && styles.spaceSelectorDark]}
                      onPress={() => {
                        setShowSpaceSelector(!showSpaceSelector);
                        setShowTypeSelector(false); // Close type selector if open
                      }}
                      activeOpacity={0.7}
                    >
                      {selectedSpaceId ? (
                        <View style={styles.selectedSpace}>
                          <View
                            style={[
                              styles.spaceColorDot,
                              { backgroundColor: spaces.find(s => s.id === selectedSpaceId)?.color || '#999' }
                            ]}
                          />
                          <Text style={[styles.spaceName, isDarkMode && styles.spaceNameDark]}>
                            {spaces.find(s => s.id === selectedSpaceId)?.name || 'Unknown'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.noSpace, isDarkMode && styles.noSpaceDark]}>
                          No space assigned
                        </Text>
                      )}
                      <Text style={styles.chevron}>{showSpaceSelector ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {/* Space Options */}
                    {showSpaceSelector && (
                      <View style={[styles.spaceOptions, isDarkMode && styles.spaceOptionsDark]}>
                        <TouchableOpacity
                          style={[
                            styles.spaceOption,
                            selectedSpaceId === null && styles.spaceOptionSelected
                          ]}
                          onPress={() => {
                            setSelectedSpaceId(null);
                            onSpaceChange?.(itemToDisplay!, null);
                            setShowSpaceSelector(false);
                          }}
                        >
                          <Text style={[styles.spaceOptionText, isDarkMode && styles.spaceOptionTextDark]}>
                            ✕ No space
                          </Text>
                        </TouchableOpacity>
                        {spaces.map((space) => (
                          <TouchableOpacity
                            key={space.id}
                            style={[
                              styles.spaceOption,
                              selectedSpaceId === space.id && styles.spaceOptionSelected
                            ]}
                            onPress={() => {
                              setSelectedSpaceId(space.id);
                              onSpaceChange?.(itemToDisplay!, space.id);
                              setShowSpaceSelector(false);
                            }}
                          >
                            <View style={styles.spaceOptionContent}>
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
                      </View>
                    )}
                  </View>

                  {/* Type Selector */}
                  <View style={styles.typeSection}>
                    <Text style={[styles.typeSectionLabel, isDarkMode && styles.typeSectionLabelDark]}>
                      Type
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
                            onPress={() => {
                              setSelectedType(option.type);
                              // Update the item's type
                              if (itemToDisplay) {
                                itemToDisplay.content_type = option.type;
                                // TODO: Call onEdit or update function to persist the change
                              }
                              setShowTypeSelector(false);
                            }}
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

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryAction]}
                      onPress={() => onChat?.(itemToDisplay!)}
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

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onShare?.(itemToDisplay!)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>
                          📤 Share
                        </Text>
                      </TouchableOpacity>

                      {itemToDisplay?.url && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={async () => {
                            if (itemToDisplay?.url) {
                              await Clipboard.setStringAsync(itemToDisplay.url);
                              Alert.alert('Link Copied', 'The URL has been copied to your clipboard');
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.actionButtonText, isDarkMode && styles.actionButtonTextDark]}>
                            🔗 Copy Link
                          </Text>
                        </TouchableOpacity>
                      )}

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
              </Animated.View>
              </ScrollView>
            </View>
          </Animated.View>
        </GestureDetector>
      </SafeAreaView>
    </Modal>
  );
});

export default ExpandedItemView;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalContainerDark: {
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  backdropDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  scrollContent: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#1C1C1E',
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
  urlContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  urlContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  urlLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urlLabelDark: {
    color: '#999',
  },
  urlText: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  urlTextDark: {
    color: '#5AC8FA',
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 20,
  },
  descriptionDark: {
    color: '#CCC',
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
  selectedSpace: {
    flexDirection: 'row',
    alignItems: 'center',
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
});