import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { Item } from '../../types';
import { formatDate, getDomain, getContentTypeIcon } from '../../utils/itemCardHelpers';
import { isAmazonUrl } from '../../utils/urlHelpers';
import RadialActionMenu from './RadialActionMenu';

const { width: screenWidth } = Dimensions.get('window');

interface ProductItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
  forceTitleWhite?: boolean;
}

const ProductItemCard = observer(({ item, onPress, onLongPress, disabled, forceTitleWhite }: ProductItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);

  const cardWidth = screenWidth / 2 - 18;

  // Check if this is an Amazon product by URL
  const isAmazon = isAmazonUrl(item.url);

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <View style={[
          styles.card,
          isDarkMode && styles.cardDark,
          isAmazon && styles.cardAmazon
        ]}>
          {/* Product Thumbnail */}
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={[
                styles.thumbnail,
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
          ) : (
            <View style={[styles.placeholder, { backgroundColor: isAmazon ? '#FF990015' : '#007AFF15' }]}>
              <Text style={styles.placeholderIcon}>{getContentTypeIcon(item.content_type)}</Text>
            </View>
          )}

          {/* Content Type Badge */}
          {/* <View style={[styles.typeBadge, { backgroundColor: isAmazon ? '#FF9900' : '#007AFF' }]}>
            <Text style={styles.typeBadgeText}>
              {isAmazon ? '📦' : '🛍️'}
            </Text>
          </View> */}

          {/* Card Content */}
          {/* <View style={styles.cardContent}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={2}>
              {item.title}
            </Text> */}

            {/* {item.desc && (
              <Text style={[styles.description, isDarkMode && styles.descriptionDark]} numberOfLines={2}>
                {item.desc}
              </Text>
            )} */}

            {/* <View style={styles.footer}>
              {getDomain(item) && (
                <Text style={[styles.domain, isDarkMode && styles.domainDark]} numberOfLines={1}>
                  {getDomain(item)}
                </Text>
              )}
              <Text style={[styles.date, isDarkMode && styles.dateDark]}>
                {formatDate(item.created_at)}
              </Text>
            </View> */}
          {/* </View> */}
        </View>
        <Text style={[
          styles.title,
          (isDarkMode && styles.titleDark),
          (forceTitleWhite ? styles.titleForceWhite : null)
        ]} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    </RadialActionMenu>
  );
});

export default ProductItemCard;

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
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  cardAmazon: {
    borderTopWidth: 5,
    borderTopColor: '#FF9900',  // Amazon Smile Orange
  },
  thumbnail: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#F0F0F0',
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
  },
  typeBadgeText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  cardContent: {
    padding: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
    paddingTop: 2,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleForceWhite: {
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
