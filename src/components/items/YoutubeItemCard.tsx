import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { Item } from '../../types';
import { formatDate } from '../../utils/itemCardHelpers';

const { width: screenWidth } = Dimensions.get('window');

interface YoutubeItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

const YoutubeItemCard = observer(({ item, onPress, onLongPress }: YoutubeItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);

  const cardWidth = screenWidth / 2 - 18;
  const isShort = item.content_type === 'youtube_short';

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress?.(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.card, isDarkMode && styles.cardDark]}>
        {/* Video Thumbnail - Full Bleed */}
        <View style={styles.thumbnailContainer}>
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={[
                styles.thumbnail,
                imageHeight ? { height: imageHeight } : null,
                // Force specific aspect ratio for YouTube Shorts
                isShort ? { height: cardWidth * (16/9) } : null,
              ]}
              contentFit="cover"
              onLoad={(e: any) => {
                if (isShort) {
                  // YouTube Shorts: 9:16 vertical aspect ratio
                  setImageHeight(cardWidth * (16/9));
                } else if (e.source && e.source.width && e.source.height) {
                  // Regular YouTube: use actual aspect ratio, capped at 1.5x width
                  const aspectRatio = e.source.height / e.source.width;
                  const calculatedHeight = cardWidth * aspectRatio;
                  const finalHeight = Math.min(calculatedHeight, cardWidth * 1.5);
                  setImageHeight(finalHeight);
                }
              }}
            />
          ) : (
            <View style={[styles.placeholderThumbnail, { height: isShort ? cardWidth * (16/9) : cardWidth * 0.56 }]}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          )}

          {/* YouTube Badge */}
          <View style={styles.youtubeBadge}>
            <Text style={styles.youtubeBadgeIcon}>▶</Text>
          </View>

          {/* Play Button Overlay */}
          <View style={styles.playButtonOverlay} pointerEvents="none">
            <View style={styles.playButton}>
              <Text style={styles.playButtonIcon}>▶</Text>
            </View>
          </View>

          {/* Floating Title Overlay at Bottom */}
          <View style={styles.titleOverlay} pointerEvents="none">
            <Text style={styles.titleText} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </View>

        {/* Footer with Date */}
        <View style={styles.footer}>
          <Text style={[styles.date, isDarkMode && styles.dateDark]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default YoutubeItemCard;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0.3,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
  },
  thumbnail: {
    width: '100%',
    minHeight: 120,
    backgroundColor: '#F0F0F0',
  },
  placeholderThumbnail: {
    width: '100%',
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 48,
    color: '#FFFFFF',
  },
  youtubeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeBadgeIcon: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonIcon: {
    fontSize: 20,
    marginLeft: 3,
    color: '#FFFFFF',
  },
  titleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 10,
    paddingTop: 20,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 17,
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
});
