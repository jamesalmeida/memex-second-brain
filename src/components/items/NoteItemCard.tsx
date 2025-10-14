import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';
import { Item } from '../../types';
import { formatDate, getContentTypeIcon, getContentTypeColor } from '../../utils/itemCardHelpers';
import RadialActionMenu from './RadialActionMenu';

const { width: screenWidth } = Dimensions.get('window');

interface NoteItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
}

const NoteItemCard = observer(({ item, onPress, onLongPress, disabled }: NoteItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [pressed, setPressed] = useState(false);

  const cardWidth = screenWidth / 2 - 18;
  const noteColor = getContentTypeColor('note');

  return (
    <RadialActionMenu item={item} onPress={onPress} disabled={disabled}>
      <View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress?.(item)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={[styles.card, isDarkMode && styles.cardDark, pressed && styles.cardPressed]}
        >
          {/* Sticky note style header */}
          <View style={[styles.noteHeader, { backgroundColor: noteColor }]}> 
            <Text style={styles.noteIcon}>{getContentTypeIcon('note')}</Text>
          </View>

          {/* Text content preview */}
          {item.content ? (
            <View style={styles.textPreviewWrapper}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.textPreviewContent, isDarkMode && styles.textDark]} numberOfLines={6}>
                {item.content}
              </Text>
            </View>
          ) : (
            <View style={styles.textPreviewWrapper}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={3}>
                {item.title}
              </Text>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.date, isDarkMode && styles.dateDark]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </RadialActionMenu>
  );
});

export default NoteItemCard;

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
  cardPressed: {
    opacity: 0.96,
  },
  noteHeader: {
    width: '100%',
    height: 10,
  },
  noteIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 14,
    color: '#FFFFFF',
  },
  textPreviewWrapper: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  textPreviewContent: {
    fontSize: 13,
    lineHeight: 19,
    color: '#333333',
  },
  textDark: {
    color: '#CCCCCC',
  },
  footer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    marginTop: 'auto',
  },
  date: {
    fontSize: 10,
    color: '#999999',
  },
  dateDark: {
    color: '#666666',
  },
});


