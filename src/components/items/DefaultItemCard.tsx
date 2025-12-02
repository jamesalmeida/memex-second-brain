import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemTypeMetadataComputed, itemTypeMetadataStore } from '../../stores/itemTypeMetadata';
import { Item } from '../../types';
import { formatDate, getDomain, getContentTypeIcon, getContentTypeColor } from '../../utils/itemCardHelpers';
import RadialActionMenu from './RadialActionMenu';

const { width: screenWidth } = Dimensions.get('window');

interface DefaultItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
}

const DefaultItemCard = observer(({ item, onPress, onLongPress, disabled }: DefaultItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get video URL and metadata from item type metadata
  const videoUrl = itemTypeMetadataComputed.getVideoUrl(item.id);
  const siteIconUrl = itemTypeMetadataComputed.getSiteIconUrl(item.id);

  // Get merged image URLs - access observables directly for reactivity
  const metadataImageUrls = itemTypeMetadataStore.typeMetadata.get().find(m => m.item_id === item.id)?.data?.image_urls || [];
  const thumbnailUrl = item.thumbnail_url;

  const imageUrls = (() => {
    const images = [...metadataImageUrls];
    if (thumbnailUrl && !images.includes(thumbnailUrl)) {
      images.unshift(thumbnailUrl);
    }
    // Filter out empty, null, undefined, or invalid URLs
    return images.filter(url => url && url.trim() !== '' && url.startsWith('http'));
  })();

  // Set up video player if item has video
  const player = useVideoPlayer(videoUrl || null, player => {
    if (player && videoUrl) {
      player.loop = true;
      player.muted = true;
      player.volume = 0;
      player.play();
    }
  });

  const hasMultipleImages = imageUrls.length > 1;
  const hasSingleImage = imageUrls.length === 1;
  const cardWidth = screenWidth / 2 - 18;

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          {/* Thumbnail or Content Preview */}
        {videoUrl && player ? (
          <View style={{ position: 'relative' }}>
            <VideoView
              player={player}
              style={[styles.thumbnail, { height: 200 }]}
              contentFit="cover"
              fullscreenOptions={{ enable: false }}
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
        <>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
              setCurrentImageIndex(newIndex);
            }}
            scrollEventThrottle={16}
            style={{ width: '100%' }}
          >
            {imageUrls.map((imageUrl, index) => (
              <Image
                key={index}
                source={{ uri: imageUrl }}
                style={[
                  styles.thumbnail,
                  { width: cardWidth, height: imageHeight || 200 }
                ]}
                contentFit="cover"
                onLoad={(e: any) => {
                  if (index === 0 && e.source && e.source.width && e.source.height) {
                    const aspectRatio = e.source.height / e.source.width;
                    const calculatedHeight = cardWidth * aspectRatio;
                    const finalHeight = Math.min(calculatedHeight, cardWidth * 1.5);
                    setImageHeight(finalHeight);
                  }
                }}
                onError={() => {
                  // If first image fails to load, show placeholder
                  if (index === 0) {
                    setImageLoadError(true);
                  }
                }}
              />
            ))}
          </ScrollView>
          {/* Dots indicator */}
          <View style={[styles.dotsContainer, isDarkMode && styles.dotsContainerDark]} pointerEvents="none">
            {imageUrls.map((_, index) => (
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
      ) : hasSingleImage && !imageLoadError ? (
        <View>
          <Image
            source={{ uri: imageUrls[0] }}
            style={[
              styles.thumbnail,
              imageHeight ? { height: imageHeight } : null
            ]}
            contentFit="cover"
            onLoad={(e: any) => {
              if (e.source && e.source.width && e.source.height) {
                const aspectRatio = e.source.height / e.source.width;
                const calculatedHeight = cardWidth * aspectRatio;
                const finalHeight = Math.min(calculatedHeight, cardWidth * 1.5);
                setImageHeight(finalHeight);
              }
            }}
            onError={() => {
              setImageLoadError(true);
            }}
          />
        </View>
      ) : (!hasSingleImage && siteIconUrl) ? (
        null
      ) : item.content ? (
        <View style={[styles.textPreview, { backgroundColor: getContentTypeColor(item.content_type) + '15' }]}>
          <Text style={[styles.textPreviewContent, isDarkMode && styles.textDark]} numberOfLines={4}>
            {item.content}
          </Text>
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: getContentTypeColor(item.content_type) + '15' }]}>
          <Text style={styles.placeholderIcon}>{getContentTypeIcon(item.content_type)}</Text>
        </View>
      )}

      {/* Content Type Badge */}
      {/* <View style={[styles.typeBadge, { backgroundColor: getContentTypeColor(item.content_type) }]}>
        {(!item.thumbnail_url && siteIconUrl) ? (
          <Image
            source={{ uri: siteIconUrl }}
            style={styles.typeBadgeIconImage}
            contentFit="cover"
          />
        ) : (
          <Text style={[
            styles.typeBadgeText,
            (item.content_type === 'x' || item.content_type === 'youtube' || item.content_type === 'youtube_short' ||
             item.content_type === 'instagram' || item.content_type === 'tiktok' || item.content_type === 'reddit' ||
             item.content_type === 'tv_show') && styles.typeBadgeTextWhite
          ]}>
            {getContentTypeIcon(item.content_type)}
          </Text>
        )}
      </View> */}

      {/* Card Content */}
      <View style={styles.cardContent}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={2}>
          {item.title}
        </Text>

        {item.desc ? (
          <Text style={[styles.description, isDarkMode && styles.descriptionDark]} numberOfLines={2}>
            {item.desc}
          </Text>
        ) : getDomain(item) ? (
          <Text style={[styles.description, isDarkMode && styles.descriptionDark]} numberOfLines={1}>
            {getDomain(item)}
          </Text>
        ) : null}

        <View style={styles.footer}>
          {getDomain(item) && (
            <Text style={[styles.domain, isDarkMode && styles.domainDark]} numberOfLines={1}>
              {getDomain(item)}
            </Text>
          )}
          <Text style={[styles.date, isDarkMode && styles.dateDark]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
        </View>
      </View>
    </RadialActionMenu>
  );
});

export default DefaultItemCard;

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
    overflow: 'hidden',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  thumbnail: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#F0F0F0',
  },
  textPreview: {
    width: '100%',
    height: 120,
    padding: 12,
    justifyContent: 'center',
  },
  textPreviewContent: {
    fontSize: 12,
    lineHeight: 18,
    color: '#333333',
  },
  placeholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 32,
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
  },
  typeBadgeIconImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  typeBadgeText: {
    fontSize: 14,
  },
  typeBadgeTextWhite: {
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
  cardContent: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 16,
  },
  descriptionDark: {
    color: '#999999',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  domain: {
    fontSize: 10,
    color: '#999999',
    flex: 1,
    marginRight: 8,
  },
  domainDark: {
    color: '#666666',
  },
  date: {
    fontSize: 10,
    color: '#999999',
  },
  dateDark: {
    color: '#666666',
  },
  textDark: {
    color: '#CCCCCC',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dotsContainerDark: {
    // No additional styles needed, but kept for consistency
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginHorizontal: 3,
  },
  dotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeDot: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
