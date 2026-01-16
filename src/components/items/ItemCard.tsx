import React from 'react';
import { observer } from '@legendapp/state/react';
import { Item } from '../../types';
import { processingItemsComputed } from '../../stores/processingItems';
import XItemCard from './XItemCard';
import YoutubeItemCard from './YoutubeItemCard';
import MovieTVItemCard from './MovieTVItemCard';
import RedditItemCard from './RedditItemCard';
import ProductItemCard from './ProductItemCard';
import PodcastItemCard from './PodcastItemCard';
import DefaultItemCard from './DefaultItemCard';
import NoteItemCard from './NoteItemCard';
import ProcessingItemCard from './ProcessingItemCard';

interface ItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

/**
 * Check if item has enough metadata to display the actual card
 * Items with title + (description OR thumbnail) can show immediately while enriching
 */
function hasBasicMetadata(item: Item): boolean {
  const hasTitle = item.title && item.title !== item.url && !item.title.startsWith('http');
  const hasDescription = item.desc && item.desc.length > 0;
  const hasThumbnail = item.thumbnail_url && item.thumbnail_url.length > 0;
  return hasTitle && (hasDescription || hasThumbnail);
}

const ItemCard = observer(({ item, onPress, onLongPress }: ItemCardProps) => {
  const isProcessing = processingItemsComputed.isProcessing(item.id);

  // Only show ProcessingItemCard if item is being processed AND lacks basic metadata
  // Items with metadata will show the actual card while enrichment happens in background
  if (isProcessing && !hasBasicMetadata(item)) {
    return <ProcessingItemCard title={item.title || item.url} />;
  }

  // Get the appropriate card component based on type
  const getCardComponent = (cardItem: Item) => {
    switch (cardItem.content_type) {
      case 'note': return NoteItemCard;
      case 'x': return XItemCard;
      case 'youtube':
      case 'youtube_short': return YoutubeItemCard;
      case 'movie':
      case 'tv_show': return MovieTVItemCard;
      case 'reddit': return RedditItemCard;
      case 'product': return ProductItemCard;
      case 'podcast':
      case 'podcast_episode': return PodcastItemCard;
      default: return DefaultItemCard;
    }
  };

  const CardComponent = getCardComponent(item);
  return <CardComponent item={item} onPress={onPress} onLongPress={onLongPress} />;
});

export default ItemCard;
