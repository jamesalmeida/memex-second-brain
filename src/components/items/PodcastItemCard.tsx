import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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

  // Get podcast-specific metadata
  const audioUrl = itemTypeMetadataComputed.getAudioUrl(item.id);
  const duration = itemTypeMetadataComputed.getDuration(item.id);
  const episodeNumber = itemTypeMetadataComputed.getEpisodeNumber(item.id);
  const seasonNumber = itemTypeMetadataComputed.getSeasonNumber(item.id);
  const isEpisode = itemTypeMetadataComputed.getIsEpisode(item.id);

  // Get metadata
  const author = itemMetadataComputed.getAuthor(item.id);
  const siteIconUrl = itemTypeMetadataComputed.getSiteIconUrl(item.id);

  const cardWidth = screenWidth / 2 - 18;

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

          {/* Podcast Artwork */}
          {item.thumbnail_url ? (
            <View style={styles.artworkContainer}>
              <Image
                source={{ uri: item.thumbnail_url }}
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
});
