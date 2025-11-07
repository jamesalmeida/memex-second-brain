import React from 'react';
import { observer } from '@legendapp/state/react';
import { Item } from '../../types';
import XItemCard from './XItemCard';
import YoutubeItemCard from './YoutubeItemCard';
import MovieTVItemCard from './MovieTVItemCard';
import RedditItemCard from './RedditItemCard';
import ProductItemCard from './ProductItemCard';
import PodcastItemCard from './PodcastItemCard';
import DefaultItemCard from './DefaultItemCard';
import NoteItemCard from './NoteItemCard';

interface ItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

const ItemCard = observer(({ item, onPress, onLongPress }: ItemCardProps) => {
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
