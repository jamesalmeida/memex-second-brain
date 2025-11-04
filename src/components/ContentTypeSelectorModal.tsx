import React, { useCallback, useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { itemsActions } from '../stores/items';
import { ContentType } from '../types';
import { BaseModal, ModalHeader, RadioButton } from './modals';

const contentTypeOptions: { type: ContentType; label: string; icon: string }[] = [
  { type: 'bookmark', label: 'Bookmark', icon: '🔖' },
  { type: 'note', label: 'Note', icon: '📝' },
  { type: 'youtube', label: 'YouTube', icon: '▶️' },
  { type: 'youtube_short', label: 'YT Short', icon: '🎬' },
  { type: 'x', label: 'X/Twitter', icon: '𝕏' },
  { type: 'instagram', label: 'Instagram', icon: '📷' },
  { type: 'tiktok', label: 'TikTok', icon: '🎵' },
  { type: 'reddit', label: 'Reddit', icon: '👽' },
  { type: 'ebay', label: 'eBay', icon: '🛒' },
  { type: 'yelp', label: 'Yelp', icon: '🍽️' },
  { type: 'app_store', label: 'App Store', icon: '' },
  { type: 'movie', label: 'Movie', icon: '🎬' },
  { type: 'tv_show', label: 'TV Show', icon: '📺' },
  { type: 'github', label: 'GitHub', icon: '⚡' },
  { type: 'article', label: 'Article', icon: '📄' },
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'video', label: 'Video', icon: '🎥' },
  { type: 'audio', label: 'Audio', icon: '🎵' },
  { type: 'podcast', label: 'Podcast', icon: '🎙️' },
  { type: 'pdf', label: 'PDF', icon: '📑' },
  { type: 'product', label: 'Product', icon: '🛍️' },
];

interface ContentTypeSelectorModalProps {
  visible: boolean;
  itemId: string;
  currentType: ContentType;
  onClose: () => void;
  onTypeChange?: (type: ContentType) => void;
}

const ContentTypeSelectorModal = observer(({
  visible,
  itemId,
  currentType,
  onClose,
  onTypeChange,
}: ContentTypeSelectorModalProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [selectedType, setSelectedType] = useState<ContentType>(currentType);

  // Sync internal state with prop when currentType changes
  useEffect(() => {
    setSelectedType(currentType);
  }, [currentType]);

  const handleTypeSelect = useCallback(async (type: ContentType) => {
    setSelectedType(type);
    await itemsActions.updateItemWithSync(itemId, { content_type: type });
    onTypeChange?.(type);
    onClose();
  }, [itemId, onClose, onTypeChange]);

  const handleCancel = useCallback(() => {
    setSelectedType(currentType);
    onClose();
  }, [currentType, onClose]);

  return (
    <BaseModal visible={visible} onClose={handleCancel}>
      <ModalHeader
        title="Select Content Type"
        onClose={handleCancel}
        isDarkMode={isDarkMode}
      />

      <ScrollView
        style={styles.typesList}
        showsVerticalScrollIndicator={false}
      >
        {contentTypeOptions.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[styles.typeItem, isDarkMode && styles.typeItemDark]}
            onPress={() => handleTypeSelect(option.type)}
            activeOpacity={0.8}
          >
            <View style={styles.typeItemContent}>
              <RadioButton selected={selectedType === option.type} />
              <Text style={styles.typeIcon}>{option.icon}</Text>
              <Text style={[styles.typeItemText, isDarkMode && styles.typeItemTextDark]}>
                {option.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </BaseModal>
  );
});

export default ContentTypeSelectorModal;

const styles = StyleSheet.create({
  typesList: {
    flexShrink: 1,
  },
  typeItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  typeItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  typeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  typeItemText: {
    fontSize: 16,
    color: '#3A3A3C',
  },
  typeItemTextDark: {
    color: '#FFFFFF',
  },
});
