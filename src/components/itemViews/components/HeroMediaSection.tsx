import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { VideoView } from 'expo-video';
import type { VideoPlayer } from 'expo-video';
import { observer } from '@legendapp/state/react';
import { itemTypeMetadataComputed } from '../../../stores/itemTypeMetadata';
import { ImageWithActions } from '../../ImageWithActions';
import { Item } from '../../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTENT_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - (CONTENT_PADDING * 2);

interface HeroMediaSectionProps {
  item: Item;
  isDarkMode: boolean;
  contentTypeIcon?: string;

  // Video props (optional)
  videoUrl?: string;
  videoPlayer?: VideoPlayer | null;
  isVideoPlaying?: boolean;
  onVideoPlay?: () => void;
  showPlayButton?: boolean;

  // Image handlers
  onImageAdd: () => void;
  onImageRemove: (imageUrl: string) => void;

  // Thumbnail handlers (for thumbnail_url fallback)
  onThumbnailRemove: () => void;

  // Optional overlay content (e.g., Reddit duration badge)
  renderOverlay?: (imageUrl: string) => React.ReactNode;

  // Style overrides
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  placeholderStyle?: StyleProp<ViewStyle>;

  // Special behavior flags
  skipForTextOnlyXPosts?: boolean; // Skip rendering hero section for X posts without media
}

const HeroMediaSection = observer(({
  item,
  isDarkMode,
  contentTypeIcon = '📎',
  videoUrl,
  videoPlayer,
  isVideoPlaying = false,
  onVideoPlay,
  showPlayButton = false,
  onImageAdd,
  onImageRemove,
  onThumbnailRemove,
  renderOverlay,
  containerStyle,
  imageStyle,
  placeholderStyle,
  skipForTextOnlyXPosts = false,
}: HeroMediaSectionProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  // Listen to video player status to get actual video dimensions
  useEffect(() => {
    if (videoPlayer) {
      const subscription = videoPlayer.addListener('statusChange', (status) => {
        if (status.videoSize) {
          setVideoDimensions({
            width: status.videoSize.width,
            height: status.videoSize.height
          });
        }
      });
      return () => subscription.remove();
    }
  }, [videoPlayer]);

  // Calculate dynamic video height based on actual aspect ratio
  const videoHeight = useMemo(() => {
    if (videoDimensions) {
      const aspectRatio = videoDimensions.height / videoDimensions.width;
      return CONTENT_WIDTH * aspectRatio;
    }
    // Fallback to 16:9 while dimensions are loading
    return CONTENT_WIDTH / (16/9);
  }, [videoDimensions]);

  // Get image URLs from item type metadata
  const metadataImageUrls = itemTypeMetadataComputed.getImageUrls(item.id) || [];

  // Combine thumbnail_url with metadata images (if thumbnail exists and not already in metadata)
  const imageUrls = useMemo(() => {
    const images = [...metadataImageUrls];

    // Prepend thumbnail if it exists and isn't already in the metadata images
    if (item.thumbnail_url && !images.includes(item.thumbnail_url)) {
      images.unshift(item.thumbnail_url);
    }

    return images;
  }, [item.thumbnail_url, metadataImageUrls]);

  const hasMultipleImages = imageUrls.length > 1;
  const hasSingleImage = imageUrls.length === 1;

  // Check if this is an X post without media (skip rendering if flag is set)
  if (skipForTextOnlyXPosts && item.content_type === 'x' && !videoUrl && (!imageUrls || imageUrls.length === 0)) {
    return null;
  }

  return (
    <View style={[styles.heroContainer, containerStyle]}>
      {/* Video Player */}
      {videoUrl && videoPlayer ? (
        <View style={styles.videoContainer}>
          <VideoView
            player={videoPlayer}
            style={{
              width: CONTENT_WIDTH,
              height: videoHeight,
              backgroundColor: '#000000',
              borderRadius: 12,
            }}
            contentFit="contain"
            fullscreenOptions={{ enable: true }}
            showsTimecodes={true}
            nativeControls={true}
          />
          {/* Play button overlay - only show if configured and not playing */}
          {showPlayButton && !isVideoPlaying && (
            <TouchableOpacity
              style={styles.videoPlayButtonOverlay}
              onPress={onVideoPlay}
              activeOpacity={0.8}
            >
              <View style={styles.videoPlayButton}>
                <Text style={styles.videoPlayButtonIcon}>▶</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      ) : hasMultipleImages ? (
        /* Image Carousel */
        <View style={styles.carouselContainer}>
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
              <View key={index} style={{ position: 'relative' }}>
                <ImageWithActions
                  source={{ uri: imageUrl }}
                  imageUrl={imageUrl}
                  style={[
                    {
                      width: CONTENT_WIDTH,
                      height: CONTENT_WIDTH,
                      backgroundColor: '#000000'
                    },
                    imageStyle
                  ]}
                  contentFit="contain"
                  canAddAnother
                  canRemove
                  onImageAdd={onImageAdd}
                  onImageRemove={() => {
                    // If this is the thumbnail, use thumbnail remove handler
                    if (imageUrl === item.thumbnail_url) {
                      onThumbnailRemove();
                    } else {
                      // Otherwise it's a metadata image
                      onImageRemove(imageUrl);
                    }
                  }}
                />
                {/* Optional overlay (e.g., Reddit duration badge) */}
                {renderOverlay && renderOverlay(imageUrl)}
              </View>
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
      ) : hasSingleImage ? (
        /* Single Image */
        <View style={{ position: 'relative' }}>
          <ImageWithActions
            source={{ uri: imageUrls![0] }}
            imageUrl={imageUrls![0]}
            style={[styles.heroMedia, imageStyle]}
            contentFit="contain"
            canAddAnother
            canRemove
            onImageAdd={onImageAdd}
            onImageRemove={() => {
              // If this is the thumbnail, use thumbnail remove handler
              if (imageUrls![0] === item.thumbnail_url) {
                onThumbnailRemove();
              } else {
                // Otherwise it's a metadata image
                onImageRemove(imageUrls![0]);
              }
            }}
          />
          {/* Optional overlay */}
          {renderOverlay && renderOverlay(imageUrls![0])}
        </View>
      ) : (
        /* Placeholder */
        <TouchableOpacity
          style={[
            styles.placeholderHero,
            isDarkMode && styles.placeholderHeroDark,
            placeholderStyle
          ]}
          onPress={onImageAdd}
          activeOpacity={0.7}
        >
          <Text style={styles.placeholderIcon}>{contentTypeIcon}</Text>
          <Text style={[styles.placeholderText, isDarkMode && styles.placeholderTextDark]}>
            Tap to add image
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default HeroMediaSection;

const styles = StyleSheet.create({
  heroContainer: {
    position: 'relative',
    paddingHorizontal: CONTENT_PADDING,
    overflow: 'hidden',
    marginTop: 10,
  },
  heroMedia: {
    width: CONTENT_WIDTH,
    minHeight: 250,
    maxHeight: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  carouselContainer: {
    position: 'relative',
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholderHero: {
    width: '100%',
    height: 250,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  placeholderHeroDark: {
    backgroundColor: '#2C2C2E',
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  placeholderTextDark: {
    color: '#999',
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
});
