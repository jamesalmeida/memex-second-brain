import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { itemTypeMetadataComputed } from '../stores/itemTypeMetadata';
import { Item } from '../types';

const { width: screenWidth } = Dimensions.get('window');

interface ItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

const ItemCard = observer(({ item, onPress, onLongPress }: ItemCardProps) => {
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
      // Always mute videos in the grid, especially for X posts
      player.muted = true;
      player.volume = 0; // Extra safety to ensure mute
      player.play();
    }
  });
  
  // Check if item has multiple images
  const hasMultipleImages = imageUrls && imageUrls.length > 1;
  const cardWidth = screenWidth / 2 - 18;

  const getContentTypeIcon = () => {
    switch (item.content_type) {
      case 'youtube':
      case 'youtube_short':
        return '▶';
      case 'x':
        return '𝕏';
      case 'instagram':
        return '📷';
      case 'reddit':
        return '👽';
      case 'movie':
        return '🎬';
      case 'tv_show':
        return '📺';
      case 'podcast':
        return '🎙️';
      case 'github':
        return '⚡';
      case 'note':
        return '📝';
      case 'image':
        return '🖼️';
      case 'article':
      case 'bookmark':
        return '🔖';
      default:
        return '📎';
    }
  };

  const getContentTypeColor = () => {
    switch (item.content_type) {
      case 'youtube':
      case 'youtube_short':
        return '#FF0000';
      case 'x':
        return '#000000';  // Black background for X
      case 'instagram':
        return '#E1306C';  // Instagram signature pink/magenta
      case 'reddit':
        return '#FF4500';  // Reddit orange
      case 'movie':
        return '#F5C518';  // IMDB yellow/gold
      case 'tv_show':
        return '#00A8E1';  // TV show blue
      case 'podcast':
        return '#8B5CF6';  // Purple for podcasts
      case 'github':
        return '#24292e';
      case 'note':
        return '#FFC107';
      case 'image':
        return '#4CAF50';
      default:
        return '#007AFF';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const getDomain = () => {
    if (!item.url) return null;
    
    // For X posts, extract username from description
    if (item.content_type === 'x' && item.desc) {
      // Look for "by @username" pattern in description
      const match = item.desc.match(/by @(\w+)$/m);
      if (match) {
        return `@${match[1]}`;
      }
      // Fallback: try to extract from title if it exists
      if (item.title) {
        const titleMatch = item.title.match(/@(\w+)/);
        if (titleMatch) {
          return `@${titleMatch[1]}`;
        }
      }
    }
    
    try {
      const url = new URL(item.url);
      return url.hostname.replace('www.', '');
    } catch {
      return null;
    }
  };

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      {/* Thumbnail or Content Preview */}
      {videoUrl && player ? (
        // Show video player for items with video
        <TouchableOpacity
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress?.(item)}
          activeOpacity={0.7}
        >
          <View style={{ position: 'relative' }}>
            <VideoView
              player={player}
              style={[
                styles.thumbnail,
                { height: 200 }
              ]}
              contentFit="cover"
              allowsFullscreen={false}
              showsTimecodes={false}
              muted={true}
            />
            {/* Show play button overlay to indicate video */}
            <View style={styles.playButtonOverlay} pointerEvents="none">
              <View style={styles.playButton}>
                <Text style={styles.playButtonIcon}>▶</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ) : hasMultipleImages ? (
        // Show carousel for multiple images
        <View style={{ position: 'relative' }}>
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
            {imageUrls!.map((imageUrl, index) => (
              <TouchableWithoutFeedback
                key={index}
                onPress={() => onPress(item)}
                onLongPress={() => onLongPress?.(item)}
              >
                <Image
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
      ) : item.thumbnail_url ? (
        <TouchableOpacity
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress?.(item)}
          activeOpacity={0.7}
        >
          <View>
            <Image
              source={{ uri: item.thumbnail_url }}
              style={[
                styles.thumbnail, 
                imageHeight ? { height: imageHeight } : null,
                // Force vertical aspect ratio for YouTube Shorts
                item.content_type === 'youtube_short' ? { height: cardWidth * (16/9) } : null
              ]}
              contentFit="cover"
              onLoad={(e: any) => {
                // For YouTube Shorts, use vertical aspect ratio
                if (item.content_type === 'youtube_short') {
                  const cardWidth = screenWidth / 2 - 18;
                  setImageHeight(cardWidth * (16/9)); // 9:16 vertical aspect ratio
                } else if (e.source && e.source.width && e.source.height) {
                  // Calculate height based on image aspect ratio for other types
                  const aspectRatio = e.source.height / e.source.width;
                  const cardWidth = screenWidth / 2 - 18; // Approximate card width
                  const calculatedHeight = cardWidth * aspectRatio;
                  // Cap maximum height to prevent overly tall cards
                  const finalHeight = Math.min(calculatedHeight, cardWidth * 1.5);
                  setImageHeight(finalHeight);
                }
              }}
            />
          </View>
        </TouchableOpacity>
      ) : item.content ? (
        <TouchableOpacity
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress?.(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.textPreview, { backgroundColor: getContentTypeColor() + '15' }]}>
            <Text style={[styles.textPreviewContent, isDarkMode && styles.textDark]} numberOfLines={4}>
              {item.content}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress?.(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.placeholder, { backgroundColor: getContentTypeColor() + '15' }]}>
            <Text style={styles.placeholderIcon}>{getContentTypeIcon()}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Content Type Badge */}
      <View style={[styles.typeBadge, { backgroundColor: getContentTypeColor() }]}>
        <Text style={[
          styles.typeBadgeText,
          (item.content_type === 'x' || item.content_type === 'youtube' || item.content_type === 'youtube_short' || item.content_type === 'instagram' || item.content_type === 'reddit' || item.content_type === 'tv_show') && styles.typeBadgeTextWhite
        ]}>
          {getContentTypeIcon()}
        </Text>
      </View>

      {/* Card Content */}
      <TouchableOpacity
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress?.(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={2}>
            {item.title}
          </Text>
          
          {item.desc && (
            <Text style={[styles.description, isDarkMode && styles.descriptionDark]} numberOfLines={2}>
              {item.desc}
            </Text>
          )}

          <View style={styles.footer}>
            {getDomain() && (
              <Text style={[styles.domain, isDarkMode && styles.domainDark]} numberOfLines={1}>
                {getDomain()}
              </Text>
            )}
            <Text style={[styles.date, isDarkMode && styles.dateDark]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

export default ItemCard;

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
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});