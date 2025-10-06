import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { Item } from '../../types';
import RadialActionMenu from './RadialActionMenu';

const { width: screenWidth } = Dimensions.get('window');

interface YoutubeItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
}

const YoutubeItemCard = observer(({ item, onPress, onLongPress, disabled }: YoutubeItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);

  const cardWidth = screenWidth / 2 - 18;
  const isShort = item.content_type === 'youtube_short';

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          {/* Video Thumbnail - Full Bleed */}
          <View style={styles.thumbnailContainer}>
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={[
                styles.thumbnail,
                imageHeight ? { height: imageHeight } : null,
              ]}
              contentFit="fill"
              onLoad={(e: any) => {
                if (e.source && e.source.width && e.source.height) {
                  // Set height to match exact aspect ratio - width is 100%, so height adjusts
                  const aspectRatio = e.source.height / e.source.width;
                  setImageHeight(cardWidth * aspectRatio);
                }
              }}
            />
          ) : (
            <View style={[styles.placeholderThumbnail, { height: isShort ? cardWidth * (16/9) : cardWidth * 0.56 }]}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          )}

          {/* Play Button Overlay - Different for Shorts */}
          <View style={styles.playButtonOverlay} pointerEvents="none">
            {isShort ? (
              <>
                <Image
                  source={require('../../../assets/icon_youtube_shorts.svg')}
                  style={styles.shortsLogo}
                  contentFit="contain"
                />
                <Image
                  source={require('../../../assets/icon_youtube_play.svg')}
                  style={styles.shortsPlayIcon}
                  contentFit="contain"
                />
              </>
            ) : (
              <>
                <Image
                  source={require('../../../assets/icon_youtube.svg')}
                  style={styles.youtubeLogo}
                  contentFit="contain"
                />
                <Image
                  source={require('../../../assets/icon_youtube_play.svg')}
                  style={styles.youtubePlayIcon}
                  contentFit="contain"
                />
              </>
            )}
          </View>
        </View>

        {/* Footer with Date */}
        {/* <View style={styles.footer}>
          <Text style={[styles.date, isDarkMode && styles.dateDark]}>
            {formatDate(item.created_at)}
          </Text>
        </View> */}

      </View>
      {/* Title Below Video */}
      <View style={styles.titleContainer}>
          <Text style={[styles.titleText, isDarkMode && styles.titleTextDark]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      </View>
    </RadialActionMenu>
  );
});

export default YoutubeItemCard;

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
    borderTopColor: 'rgba(255, 0, 0, 0.8)',
    overflow: 'hidden',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
  },
  thumbnail: {
    width: '100%',
    minHeight: 100,
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
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  youtubeLogo: {
    width: 42,
    height: 30,
    opacity: 0.75,
  },
  youtubePlayIcon: {
    position: 'absolute',
    width: 42,
    height:30,
    opacity: 1,
  },
  shortsLogo: {
    width: 48,
    height: 60,
    opacity: 0.75,
  },
  shortsPlayIcon: {
    position: 'absolute',
    width: 56,
    height: 68,
    opacity: 1,
  },
  titleContainer: {
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 4,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 17,
    textAlign: 'center',
  },
  titleTextDark: {
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
});
