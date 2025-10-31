import React, { useCallback, useState, useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { itemsActions } from '../stores/items';
import { ContentType } from '../types';

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={[styles.modalContent, isDarkMode && styles.modalContentDark]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                Select Content Type
              </Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={isDarkMode ? '#FFFFFF' : '#3A3A3C'} />
              </TouchableOpacity>
            </View>

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
                    <View style={[
                      styles.radioButton,
                      selectedType === option.type && styles.radioButtonSelected
                    ]}>
                      {selectedType === option.type && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <Text style={styles.typeIcon}>{option.icon}</Text>
                    <Text style={[styles.typeItemText, isDarkMode && styles.typeItemTextDark]}>
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

export default ContentTypeSelectorModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 20,
  },
  backdrop: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A3A3C',
    letterSpacing: 0.5,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
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
