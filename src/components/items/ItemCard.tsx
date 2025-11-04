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
import ProcessingItemCard from './ProcessingItemCard';
import { processingItemsComputed } from '../../stores/processingItems';
import NoteItemCard from './NoteItemCard';

interface ItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

const ItemCard = observer(({ item, onPress, onLongPress }: ItemCardProps) => {
  if (processingItemsComputed.isProcessing(item.id)) {
    return <ProcessingItemCard title={item.title} />;
  }
  switch (item.content_type) {
    case 'note':
      return <NoteItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;
    case 'x':
      return <XItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    case 'youtube':
    case 'youtube_short':
      return <YoutubeItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    case 'movie':
    case 'tv_show':
      return <MovieTVItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    case 'reddit':
      return <RedditItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    case 'product':
      return <ProductItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    case 'podcast':
    case 'podcast_episode':
      return <PodcastItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    default:
      return <DefaultItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;
  }
});

export default ItemCard;
