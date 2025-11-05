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
import { spacesComputed } from '../stores/spaces';
import { itemsActions } from '../stores/items';
import { BaseModal, ModalHeader, RadioButton } from './modals';

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
  const allSpaces = spacesComputed.activeSpaces();

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
    <BaseModal visible={visible} onClose={handleCancel}>
      <ModalHeader
        title="Select Space"
        onClose={handleCancel}
        isDarkMode={isDarkMode}
      />

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
            <RadioButton selected={selectedSpaceId === null} />
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
              <RadioButton
                selected={selectedSpaceId === space.id}
                color={space.color}
              />
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
    </BaseModal>
  );
});

export default SpaceSelectorModal;

const styles = StyleSheet.create({
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
