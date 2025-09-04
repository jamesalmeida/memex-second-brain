import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
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
  
  // Set up video player if item has video
  const player = useVideoPlayer(item.video_url ? item.video_url : null, player => {
    if (player && item.video_url) {
      player.loop = true;
      player.muted = true;
      player.play();
    }
  });

  const getContentTypeIcon = () => {
    switch (item.content_type) {
      case 'youtube':
        return '▶️';
      case 'x':
        return '𝕏';
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
        return '#FF0000';
      case 'x':
        return '#000000';  // Black background for X
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
    <TouchableOpacity
      style={[styles.card, isDarkMode && styles.cardDark]}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress?.(item)}
      activeOpacity={0.7}
    >
      {/* Thumbnail or Content Preview */}
      {item.video_url && player ? (
        // Show video player for items with video
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
          />
          {/* Show play button overlay to indicate video */}
          <View style={styles.playButtonOverlay} pointerEvents="none">
            <View style={styles.playButton}>
              <Text style={styles.playButtonIcon}>▶️</Text>
            </View>
          </View>
        </View>
      ) : item.thumbnail_url ? (
        <View>
          <Image
            source={{ uri: item.thumbnail_url }}
            style={[
              styles.thumbnail, 
              imageHeight ? { height: imageHeight } : null
            ]}
            contentFit="cover"
            onLoad={(e: any) => {
              // Calculate height based on image aspect ratio
              if (e.source && e.source.width && e.source.height) {
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
      ) : item.content ? (
        <View style={[styles.textPreview, { backgroundColor: getContentTypeColor() + '15' }]}>
          <Text style={[styles.textPreviewContent, isDarkMode && styles.textDark]} numberOfLines={4}>
            {item.content}
          </Text>
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: getContentTypeColor() + '15' }]}>
          <Text style={styles.placeholderIcon}>{getContentTypeIcon()}</Text>
        </View>
      )}

      {/* Content Type Badge */}
      <View style={[styles.typeBadge, { backgroundColor: getContentTypeColor() }]}>
        <Text style={[
          styles.typeBadgeText,
          item.content_type === 'x' && styles.typeBadgeTextWhite
        ]}>
          {getContentTypeIcon()}
        </Text>
      </View>

      {/* Card Content */}
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
  );
});

export default ItemCard;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
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
});