import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { Item } from '../../types';
import RadialActionMenu from './RadialActionMenu';

const { width: screenWidth } = Dimensions.get('window');

interface RedditItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
}

const RedditItemCard = observer(({ item, onPress, onLongPress, disabled }: RedditItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get video URL from item type metadata
  const videoUrl = itemTypeMetadataComputed.getVideoUrl(item.id);

  // Set up video player
  const player = useVideoPlayer(videoUrl || null, player => {
    if (player && videoUrl) {
      player.loop = true;
      player.muted = true;
      player.volume = 0;
      player.play();
    }
  });

  // Get image URLs from item type metadata
  const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);

  const hasMultipleImages = imageUrls && imageUrls.length > 1;
  const cardWidth = isDarkMode ? screenWidth / 2 - 14 : screenWidth / 2 - 18;
  const mediaWidth = cardWidth - 24; // Account for 12px padding on each side

  // Extract subreddit from author field (format: "r/subreddit")
  const subreddit = item.desc?.startsWith('r/')
    ? item.desc.split(':')[0]
    : null;

  // Use title for the post title
  const postTitle = item.title;

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          {/* Reddit Icon Badge - Top Right */}
          <View style={styles.redditIconContainer}>
            <Text style={[styles.redditIcon, isDarkMode && styles.redditIconDark]}>🤖</Text>
          </View>

            {/* Subreddit Header */}
            {subreddit && (
              <View style={styles.header}>
                <Text style={[styles.subreddit, isDarkMode && styles.subredditDark]}>
                  {subreddit}
                </Text>
              </View>
            )}

            {/* Post Title */}
            <View style={styles.contentContainer}>
              <Text style={[styles.postTitle, isDarkMode && styles.postTitleDark]} numberOfLines={4}>
                {postTitle}
              </Text>
            </View>

            {/* Media Below (Video or Images) */}
            {videoUrl && player ? (
              <View style={styles.mediaContainer}>
                <View style={{ position: 'relative' }}>
                  <VideoView
                    player={player}
                    style={[styles.media, { height: 200 }]}
                    contentFit="cover"
                    nativeControls={false}
                  />
                  <View style={styles.playButtonOverlay} pointerEvents="none">
                    <View style={styles.playButton}>
                      <Text style={styles.playButtonIcon}>▶</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : hasMultipleImages ? (
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
              </View>
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
            ) : item.thumbnail_url ? (
              <View style={styles.mediaContainer}>
                <Image
                  source={{ uri: item.thumbnail_url }}
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
        </View>
      </View>
    </RadialActionMenu>
  );
});

export default RedditItemCard;

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
    borderTopColor: '#FF4500', // Reddit orange
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
  redditIconContainer: {
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
  redditIcon: {
    fontSize: 18,
    color: '#666666',
  },
  redditIconDark: {
    color: '#D3D3D3',
  },
  subreddit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF4500', // Reddit orange
  },
  subredditDark: {
    color: '#FF6B35', // Lighter orange for dark mode
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  postTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#000000',
  },
  postTitleDark: {
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
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  activeDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 6,
    height: 6,
    borderRadius: 3,
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
    borderRadius: 8,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  playButtonIcon: {
    fontSize: 20,
    color: '#000',
    marginLeft: 3,
  },
});
