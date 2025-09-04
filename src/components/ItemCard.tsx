import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { Item } from '../types';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 36) / 2; // 2 columns with padding

interface ItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

const ItemCard = observer(({ item, onPress, onLongPress }: ItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();

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
        return '#1DA1F2';
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
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
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
        <Text style={styles.typeBadgeText}>{getContentTypeIcon()}</Text>
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
    width: CARD_WIDTH,
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
    height: CARD_WIDTH * 0.65,
    backgroundColor: '#F0F0F0',
  },
  textPreview: {
    width: '100%',
    height: CARD_WIDTH * 0.65,
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
    height: CARD_WIDTH * 0.65,
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