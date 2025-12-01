import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemTypeMetadataComputed } from '../../stores/itemTypeMetadata';
import { itemMetadataComputed } from '../../stores/itemMetadata';
import { Item } from '../../types';
import { formatDate, getDomain } from '../../utils/itemCardHelpers';
import RadialActionMenu from './RadialActionMenu';

const { width: screenWidth } = Dimensions.get('window');

interface PodcastItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
}

const PodcastItemCard = observer(({ item, onPress, onLongPress, disabled }: PodcastItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get podcast-specific metadata
  const audioUrl = itemTypeMetadataComputed.getAudioUrl(item.id);
  const duration = itemTypeMetadataComputed.getDuration(item.id);
  const episodeNumber = itemTypeMetadataComputed.getEpisodeNumber(item.id);
  const seasonNumber = itemTypeMetadataComputed.getSeasonNumber(item.id);
  const isEpisode = itemTypeMetadataComputed.getIsEpisode(item.id);

  // Get metadata
  const author = itemMetadataComputed.getAuthor(item.id);
  const siteIconUrl = itemTypeMetadataComputed.getSiteIconUrl(item.id);
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

  const cardWidth = screenWidth / 2 - 18;
  const hasMultipleImages = imageUrls.length > 1;
  const hasSingleImage = imageUrls.length === 1;

  // Format duration from seconds to MM:SS or HH:MM:SS
  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format episode number (S##E## format)
  const formatEpisodeInfo = () => {
    if (seasonNumber && episodeNumber) {
      return `S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}`;
    } else if (episodeNumber) {
      return `EP ${episodeNumber}`;
    }
    return null;
  };

  const episodeInfo = formatEpisodeInfo();
  const durationText = formatDuration(duration);

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          {/* Purple accent border for podcast branding */}
          <View style={styles.accentBorder} />

          {/* Podcast Artwork - Carousel or Single Image */}
          {hasMultipleImages ? (
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
              >
                {imageUrls.map((imageUrl, index) => (
                  <Image
                    key={index}
                    source={{ uri: imageUrl }}
                    style={[
                      styles.artwork,
                      { width: cardWidth },
                      imageHeight ? { height: imageHeight } : null
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
            <View style={styles.artworkContainer}>
              <Image
                source={{ uri: imageUrls[0] }}
                style={[
                  styles.artwork,
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
          ) : (
            <View style={[styles.placeholderArtwork, isDarkMode && styles.placeholderArtworkDark]}>
              <Text style={styles.placeholderIcon}>🎙️</Text>
            </View>
          )}

          {/* Episode/Duration Badge */}
          {/* {(episodeInfo || durationText) && (
            <View style={[styles.metadataBadge, isDarkMode && styles.metadataBadgeDark]}>
              {episodeInfo && (
                <Text style={[styles.metadataBadgeText, isDarkMode && styles.metadataBadgeTextDark]}>
                  {episodeInfo}
                </Text>
              )}
              {episodeInfo && durationText && (
                <Text style={[styles.metadataSeparator, isDarkMode && styles.metadataBadgeTextDark]}>
                  {' • '}
                </Text>
              )}
              {durationText && (
                <Text style={[styles.metadataBadgeText, isDarkMode && styles.metadataBadgeTextDark]}>
                  {durationText}
                </Text>
              )}
            </View>
          )} */}

          {/* Card Content */}
            {item.content_type === 'podcast_episode' && (
              <View style={styles.cardContent}>
                <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            )}

        </View>
      </View>
    </RadialActionMenu>
  );
});

export default PodcastItemCard;

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
    position: 'relative',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  accentBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#8B5CF6', // Purple accent for podcast
    zIndex: 10,
  },
  artworkContainer: {
    position: 'relative',
    width: '100%',
  },
  artwork: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#F0F0F0',
  },
  placeholderArtwork: {
    width: '100%',
    height: 150,
    backgroundColor: '#8B5CF615',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderArtworkDark: {
    backgroundColor: '#8B5CF625',
  },
  placeholderIcon: {
    fontSize: 48,
  },
  metadataBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 5,
  },
  metadataBadgeDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  metadataBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  metadataBadgeTextDark: {
    color: '#FFFFFF',
  },
  metadataSeparator: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  cardContent: {
    padding: 12,
  },
  author: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6', // Purple for podcast branding
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  authorDark: {
    color: '#A78BFA', // Lighter purple for dark mode
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    lineHeight: 18,
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
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainerDark: {
    // No additional styles needed, but kept for consistency
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  dotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
