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
import { spacesStore } from '../stores/spaces';
import { itemsActions } from '../stores/items';

interface SpaceSelectorModalProps {
  visible: boolean;
  itemId: string;
  currentSpaceId: string | null;
  onClose: () => void;
  onSpaceChange?: (spaceId: string | null) => void;
}

const SpaceSelectorModal = observer(({
  visible,
  itemId,
  currentSpaceId,
  onClose,
  onSpaceChange,
}: SpaceSelectorModalProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(currentSpaceId);
  const allSpaces = spacesStore.spaces.get().filter(s => !s.is_deleted && !s.is_archived);

  // Sync internal state with prop when currentSpaceId changes
  useEffect(() => {
    setSelectedSpaceId(currentSpaceId);
  }, [currentSpaceId]);

  const handleSpaceSelect = useCallback(async (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
    await itemsActions.updateItemWithSync(itemId, { space_id: spaceId });
    onSpaceChange?.(spaceId);
    onClose();
  }, [itemId, onClose, onSpaceChange]);

  const handleCancel = useCallback(() => {
    setSelectedSpaceId(currentSpaceId);
    onClose();
  }, [currentSpaceId, onClose]);

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
                Select Space
              </Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={isDarkMode ? '#FFFFFF' : '#3A3A3C'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.spacesList}
              showsVerticalScrollIndicator={false}
            >
              {/* Everything Option */}
              <TouchableOpacity
                style={[styles.spaceItem, isDarkMode && styles.spaceItemDark]}
                onPress={() => handleSpaceSelect(null)}
                activeOpacity={0.8}
              >
                <View style={styles.spaceItemContent}>
                  <View style={[
                    styles.radioButton,
                    selectedSpaceId === null && styles.radioButtonSelected
                  ]}>
                    {selectedSpaceId === null && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={[styles.spaceItemText, isDarkMode && styles.spaceItemTextDark]}>
                    📂 Everything (No Space)
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Individual Spaces */}
              {allSpaces.map((space) => (
                <TouchableOpacity
                  key={space.id}
                  style={[styles.spaceItem, isDarkMode && styles.spaceItemDark]}
                  onPress={() => handleSpaceSelect(space.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.spaceItemContent}>
                    <View style={[
                      styles.radioButton,
                      selectedSpaceId === space.id && styles.radioButtonSelected,
                      selectedSpaceId === space.id && { borderColor: space.color }
                    ]}>
                      {selectedSpaceId === space.id && (
                        <View style={[styles.radioButtonInner, { backgroundColor: space.color }]} />
                      )}
                    </View>
                    <View style={[styles.spaceDot, { backgroundColor: space.color }]} />
                    <Text style={[styles.spaceItemText, isDarkMode && styles.spaceItemTextDark]}>
                      {space.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {allSpaces.length === 0 && (
                <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
                  No spaces yet. Create one to organize your items.
                </Text>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

export default SpaceSelectorModal;

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
  spacesList: {
    flexShrink: 1,
  },
  spaceItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  spaceItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  spaceItemContent: {
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
  spaceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  spaceItemText: {
    fontSize: 16,
    color: '#3A3A3C',
  },
  spaceItemTextDark: {
    color: '#FFFFFF',
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#8E8E93',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateTextDark: {
    color: '#A1A1A6',
  },
});
