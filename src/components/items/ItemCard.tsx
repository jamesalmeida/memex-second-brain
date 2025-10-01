import React from 'react';
import { observer } from '@legendapp/state/react';
import { Item } from '../../types';
import XItemCard from './XItemCard';
import YoutubeItemCard from './YoutubeItemCard';
import DefaultItemCard from './DefaultItemCard';

interface ItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

const ItemCard = observer(({ item, onPress, onLongPress }: ItemCardProps) => {
  switch (item.content_type) {
    case 'x':
      return <XItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    case 'youtube':
    case 'youtube_short':
      return <YoutubeItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;

    default:
      return <DefaultItemCard item={item} onPress={onPress} onLongPress={onLongPress} />;
  }
});

export default ItemCard;
