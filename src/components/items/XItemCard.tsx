import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { expandedItemUIStore } from '../../stores/expandedItemUI';
import { Item } from '../../types';
import { formatDate, extractUsername } from '../../utils/itemCardHelpers';
import { itemMetadataComputed } from '../../stores/itemMetadata';
import RadialActionMenu from './RadialActionMenu';

const { width: screenWidth } = Dimensions.get('window');

interface XItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
}

const XItemCard = observer(({ item, onPress, onLongPress, disabled }: XItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const autoplayEnabled = expandedItemUIStore.autoplayXVideos.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  // Get video URL and image URLs from item type metadata
  const videoUrl = itemTypeMetadataComputed.getVideoUrl(item.id);
  const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);

  // Set up video player if item has video
  // Grid view: Always muted, only autoplays if setting is enabled
  const player = useVideoPlayer(videoUrl || null, player => {
    if (player && videoUrl) {
      player.loop = true;
      player.muted = true;
      player.volume = 0;

      // Only autoplay if setting is enabled
      if (autoplayEnabled) {
        player.play();
      }
    }
  });

  // React to autoplay setting changes
  useEffect(() => {
    if (player && videoUrl) {
      if (autoplayEnabled) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [autoplayEnabled, player, videoUrl]);

  // Listen to video player status to get actual video dimensions
  useEffect(() => {
    if (player && videoUrl) {
      const subscription = player.addListener('statusChange', (status) => {
        if (status.videoSize) {
          setVideoDimensions({
            width: status.videoSize.width,
            height: status.videoSize.height
          });
        }
      });
      return () => subscription.remove();
    } else {
      // Reset video dimensions if no video
      setVideoDimensions(null);
    }
  }, [player, videoUrl]);

  // Calculate video height based on actual aspect ratio
  const videoHeight = useMemo(() => {
    if (videoDimensions) {
      const aspectRatio = videoDimensions.height / videoDimensions.width;
      return mediaWidth * aspectRatio;
    }
    // Fallback while dimensions are loading
    return 200;
  }, [videoDimensions, mediaWidth]);

  const hasMultipleImages = imageUrls && imageUrls.length > 1;
  const cardWidth = isDarkMode ? screenWidth / 2 - 14 : screenWidth / 2 - 18;
  const mediaWidth = cardWidth - 24; // Account for 12px padding on each side
  const metadataForItem = itemMetadataComputed.getMetadataForItem(item.id);
  const username = metadataForItem?.username || extractUsername(item);

  // Tweet text content (prefer post_content over desc/title for X posts)
  // @ts-ignore post_content may not exist in Item type locally yet
  const tweetText = (item as any).post_content || item.desc || item.title;

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          {/* X Icon Badge - Top Right */}
          <View style={styles.xIconContainer}>
            <Text style={[styles.xIcon, isDarkMode && styles.xIconDark]}>𝕏</Text>
          </View>

        {/* Tweet-style Header */}
        <View style={styles.header}>
          {username && (
            <Text style={[styles.username, isDarkMode && styles.usernameDark]}>
              @{username}
            </Text>
          )}
        </View>

        {/* Tweet Text Content */}
        <View style={styles.contentContainer}>
          <Text style={[styles.tweetText, isDarkMode && styles.tweetTextDark]} numberOfLines={4}>
            {tweetText}
          </Text>
        </View>

        {/* Media Below (Video or Images) */}
        {videoUrl && player ? (
          <View style={styles.mediaContainer}>
            <VideoView
              player={player}
              style={[styles.media, { height: videoHeight }]}
              contentFit="cover"
              nativeControls={false}
              fullscreenOptions={{ enabled: false }}
              showsTimecodes={false}
            />
            {/* Only show play button overlay when autoplay is OFF */}
            {!autoplayEnabled && (
              <View style={styles.playButtonOverlay} pointerEvents="none">
                <View style={styles.playButton}>
                  <Text style={styles.playButtonIcon}>▶</Text>
                </View>
              </View>
            )}
          </View>
        ) : hasMultipleImages ? (
          <>
            <View style={styles.mediaContainer}>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const newIndex = Math.round(event.nativeEvent.contentOffset.x / mediaWidth);
                  setCurrentImageIndex(newIndex);
                }}
                scrollEventThrottle={16}
              >
                {imageUrls!.map((imageUrl, index) => (
                  <Image
                    key={index}
                    source={{ uri: imageUrl }}
                    style={[styles.media, { width: mediaWidth, height: imageHeight || 200 }]}
                    contentFit="cover"
                    onLoad={(e: any) => {
                      if (index === 0 && e.source && e.source.width && e.source.height) {
                        const aspectRatio = e.source.height / e.source.width;
                        const calculatedHeight = mediaWidth * aspectRatio;
                        setImageHeight(calculatedHeight);
                      }
                    }}
                  />
                ))}
              </ScrollView>
            </View>
            {/* Dots indicator */}
            <View style={[styles.dotsContainer, isDarkMode && styles.dotsContainerDark]} pointerEvents="none">
              {imageUrls!.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isDarkMode && styles.dotDark,
                    index === currentImageIndex && (isDarkMode ? styles.activeDotDark : styles.activeDot)
                  ]}
                />
              ))}
            </View>
          </>
        ) : imageUrls && imageUrls.length === 1 ? (
          <View style={styles.mediaContainer}>
            <Image
              source={{ uri: imageUrls[0] }}
              style={[styles.media, imageHeight ? { height: imageHeight } : { height: 200 }]}
              contentFit="cover"
              onLoad={(e: any) => {
                if (e.source && e.source.width && e.source.height) {
                  const aspectRatio = e.source.height / e.source.width;
                  const calculatedHeight = mediaWidth * aspectRatio;
                  setImageHeight(calculatedHeight);
                }
              }}
            />
          </View>
        ) : null}

        {/* Footer */}
        {/* <View style={styles.footer}>
          <Text style={[styles.date, isDarkMode && styles.dateDark]}>
            {formatDate(item.created_at)}
          </Text>
        </View> */}
        </View>
      </View>
    </RadialActionMenu>
  );
});

export default XItemCard;

const styles = StyleSheet.create({
  shadowContainer: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  shadowContainerDark: {
    shadowOpacity: 0.4,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderTopWidth: 5,
    borderTopColor: '#1DA1F2',
    overflow: 'hidden',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  xIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  xIcon: {
    fontSize: 18,
    color: '#666666',
  },
  xIconDark: {
    color: '#D3D3D3',
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  usernameDark: {
    color: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  tweetText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#000000',
  },
  tweetTextDark: {
    color: '#FFFFFF',
  },
  mediaContainer: {
    position: 'relative',
    width: '100%',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  media: {
    width: '100%',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    bottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonIcon: {
    fontSize: 16,
    marginLeft: 2,
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  date: {
    fontSize: 11,
    color: '#999999',
  },
  dateDark: {
    color: '#666666',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 12,
  },
  dotsContainerDark: {
    // No additional styles needed, but kept for consistency
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginHorizontal: 2,
  },
  dotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeDot: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
