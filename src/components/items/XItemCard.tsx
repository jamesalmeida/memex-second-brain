import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { Item } from '../../types';
import { formatDate, extractUsername } from '../../utils/itemCardHelpers';

const { width: screenWidth } = Dimensions.get('window');

interface XItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

const XItemCard = observer(({ item, onPress, onLongPress }: XItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get video URL and image URLs from item type metadata
  const videoUrl = itemTypeMetadataComputed.getVideoUrl(item.id);
  const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);

  // Set up video player if item has video
  const player = useVideoPlayer(videoUrl || null, player => {
    if (player && videoUrl) {
      player.loop = true;
      player.muted = true;
      player.volume = 0;
      player.play();
    }
  });

  const hasMultipleImages = imageUrls && imageUrls.length > 1;
  const cardWidth = isDarkMode ? screenWidth / 2 - 14 : screenWidth / 2 - 18;
  const mediaWidth = cardWidth - 24; // Account for 12px padding on each side
  const username = extractUsername(item);

  // Tweet text content (prefer desc over title for X posts)
  const tweetText = item.desc || item.title;

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress?.(item)}
      activeOpacity={0.7}
    >
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
              style={[styles.media, { height: imageHeight || 200 }]}
              contentFit="cover"
              allowsFullscreen={false}
              showsTimecodes={false}
              muted={true}
            />
            <View style={styles.playButtonOverlay} pointerEvents="none">
              <View style={styles.playButton}>
                <Text style={styles.playButtonIcon}>▶</Text>
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
                <TouchableWithoutFeedback key={index}>
                  <Image
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
                </TouchableWithoutFeedback>
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
        ) : null}

        {/* Footer */}
        {/* <View style={styles.footer}>
          <Text style={[styles.date, isDarkMode && styles.dateDark]}>
            {formatDate(item.created_at)}
          </Text>
        </View> */}
        </View>
      </View>
    </TouchableOpacity>
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
});
