import { Item } from '../types';

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;

  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
};

export const getDomain = (item: Item): string | null => {
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

export const extractUsername = (item: Item): string | null => {
  if (item.content_type !== 'x') return null;

  // Look for "by @username" pattern in description
  if (item.desc) {
    const match = item.desc.match(/by @(\w+)$/m);
    if (match) {
      return match[1];
    }
  }

  // Fallback: try to extract from title if it exists
  if (item.title) {
    const titleMatch = item.title.match(/@(\w+)/);
    if (titleMatch) {
      return titleMatch[1];
    }
  }

  return null;
};

export const getContentTypeIcon = (contentType: string): string => {
  switch (contentType) {
    case 'youtube':
    case 'youtube_short':
      return '▶';
    case 'x':
      return '𝕏';
    case 'instagram':
      return '📷';
    case 'tiktok':
      return '🎵';
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
    case 'amazon':
      return '📦';
    case 'product':
      return '🛍️';
    default:
      return '📎';
  }
};

export const getContentTypeColor = (contentType: string): string => {
  switch (contentType) {
    case 'youtube':
    case 'youtube_short':
      return '#FF0000';
    case 'x':
      return '#000000';  // Black background for X
    case 'instagram':
      return '#E1306C';  // Instagram signature pink/magenta
    case 'tiktok':
      return '#000000';  // TikTok black
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
    case 'amazon':
      return '#FF9900';  // Amazon Smile Orange
    case 'product':
      return '#007AFF';
    default:
      return '#007AFF';
  }
};
