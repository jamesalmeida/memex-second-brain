import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { itemTypeMetadataComputed, itemTypeMetadataStore } from '../../stores/itemTypeMetadata';
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [cardWidth, setCardWidth] = useState(screenWidth / 2 - 18);

  // Check if this is an Amazon product by URL
  const isAmazon = isAmazonUrl(item.url);

  // Track failed image URLs so we can filter them out
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  // Get merged image URLs - access observables directly for reactivity
  const metadataImageUrls = itemTypeMetadataStore.typeMetadata.get().find(m => m.item_id === item.id)?.data?.image_urls || [];
  const thumbnailUrl = item.thumbnail_url;

  const imageUrls = (() => {
    const images = [...metadataImageUrls];
    // Only add thumbnail if it's a valid URL
    if (thumbnailUrl &&
        typeof thumbnailUrl === 'string' &&
        thumbnailUrl.trim() !== '' &&
        thumbnailUrl.startsWith('http') &&
        !images.includes(thumbnailUrl)) {
      images.unshift(thumbnailUrl);
    }
    // Filter out empty, null, undefined, or invalid URLs
    return images.filter(url => url && typeof url === 'string' && url.trim() !== '' && url.startsWith('http'));
  })();

  // Filter out images that failed to load
  const displayableImages = imageUrls.filter(url => !failedImageUrls.has(url));

  const hasMultipleImages = displayableImages.length > 1;
  const hasSingleImage = displayableImages.length === 1;

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <View
          style={[
            styles.card,
            isDarkMode && styles.cardDark,
            isAmazon && styles.cardAmazon
          ]}
          onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        >
          {/* Product Media - Carousel or Single Image */}
          {hasMultipleImages ? (
            <>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={{ width: cardWidth }}
                onMomentumScrollEnd={(event) => {
                  const newIndex = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
                  setCurrentImageIndex(newIndex);
                }}
                scrollEventThrottle={16}
              >
                {displayableImages.map((imageUrl, index) => (
                  <Image
                    key={imageUrl}
                    source={{ uri: imageUrl }}
                    style={[
                      styles.thumbnail,
                      { width: cardWidth },
                      imageHeight ? { height: imageHeight } : null
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
                    onError={() => {
                      // Track failed images so they get filtered out
                      setFailedImageUrls(prev => new Set(prev).add(imageUrl));
                    }}
                  />
                ))}
              </ScrollView>
              {/* Dots indicator */}
              <View style={[styles.dotsContainer, isDarkMode && styles.dotsContainerDark]} pointerEvents="none">
                {displayableImages.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      isDarkMode && styles.dotDark,
                      index === currentImageIndex && (isDarkMode ? styles.activeDotDark : styles.activeDot)
                    ]}
                  />
                ))}
              </View>
            </>
          ) : hasSingleImage && !imageLoadError ? (
            <View style={styles.mediaContainer}>
              <Image
                source={{ uri: displayableImages[0] }}
                style={[
                  styles.thumbnail,
                  { width: cardWidth },
                  imageHeight ? { height: imageHeight } : { height: 200 }
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
                onError={() => {
                  // Track failed image
                  setFailedImageUrls(prev => new Set(prev).add(displayableImages[0]));
                  setImageLoadError(true);
                }}
              />
            </View>
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
  mediaContainer: {
    position: 'relative',
    width: '100%',
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
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainerDark: {
    // No additional styles needed, but kept for consistency
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  dotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDotDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
