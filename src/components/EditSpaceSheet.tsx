import React, { forwardRef, useMemo, useCallback, useState, useEffect, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { spacesActions } from '../stores/spaces';
import { itemsStore, itemsActions } from '../stores/items';
import { Space } from '../types';

interface EditSpaceSheetProps {
  onSpaceUpdated?: (space: Space) => void;
  onSpaceDeleted?: (spaceId: string) => void;
}

export interface EditSpaceSheetRef {
  openWithSpace: (space: Space) => void;
}

const EMOJI_OPTIONS = [null, '📁', '🚀', '💡', '📚', '🎨', '🔬', '🎯', '💼', '🌟', '🔥', '⚡'];
const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#DDA0DD',
  '#FF8C94', '#98D8C8', '#6C5CE7', '#55A3FF', '#FD79A8', '#A29BFE',
];

const EditSpaceSheet = observer(
  forwardRef<EditSpaceSheetRef, EditSpaceSheetProps>(({ onSpaceUpdated, onSpaceDeleted }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const bottomSheetRef = React.useRef<BottomSheet>(null);
    const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
    const [spaceName, setSpaceName] = useState('');
    const [spaceDescription, setSpaceDescription] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState('#4ECDC4');
    
    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      openWithSpace: (space: Space) => {
        setCurrentSpace(space);
        setSpaceName(space.name);
        setSpaceDescription(space.description || '');
        setSelectedEmoji(space.icon || null);
        setSelectedColor(space.color);
        bottomSheetRef.current?.snapToIndex(0);
      }
    }));
    
    // Snap points for the bottom sheet
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    // Render backdrop
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const handleUpdate = () => {
      if (!currentSpace) return;
      
      if (!spaceName.trim()) {
        Alert.alert('Error', 'Please enter a space name');
        return;
      }

      const updatedSpace: Space = {
        ...currentSpace,
        name: spaceName.trim(),
        description: spaceDescription.trim(),
        color: selectedColor,
        icon: selectedEmoji || undefined,
        updated_at: new Date().toISOString(),
      };

      spacesActions.updateSpace(currentSpace.id, updatedSpace);
      onSpaceUpdated?.(updatedSpace);
      
      // Close sheet
      bottomSheetRef.current?.close();
    };

    const handleDelete = () => {
      if (!currentSpace) return;
      
      Alert.alert(
        'Delete Space',
        `Are you sure you want to delete "${currentSpace.name}"? This space will be removed from all items that use it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              // Remove space from all items that have it
              const allItems = itemsStore.items.get();
              allItems.forEach(item => {
                if (item.space_ids?.includes(currentSpace.id)) {
                  const updatedSpaceIds = item.space_ids.filter(id => id !== currentSpace.id);
                  itemsActions.updateItem(item.id, { space_ids: updatedSpaceIds });
                }
              });
              
              // Delete the space
              spacesActions.removeSpace(currentSpace.id);
              onSpaceDeleted?.(currentSpace.id);
              
              // Close sheet
              bottomSheetRef.current?.close();
            }
          }
        ]
      );
    };

    const handleCancel = () => {
      bottomSheetRef.current?.close();
    };

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
      >
        <BottomSheetScrollView 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>
              Edit Space
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          {/* Space Name Input */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>Name</Text>
            <BottomSheetTextInput
              style={[styles.input, isDarkMode && styles.inputDark]}
              value={spaceName}
              onChangeText={setSpaceName}
              placeholder="Enter space name"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
            />
          </View>

          {/* Description Input */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>Description</Text>
            <BottomSheetTextInput
              style={[styles.textArea, isDarkMode && styles.inputDark]}
              value={spaceDescription}
              onChangeText={setSpaceDescription}
              placeholder="Add a description (optional)"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Emoji Selector */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
              {EMOJI_OPTIONS.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.emojiOption,
                    selectedEmoji === emoji && styles.selectedOption,
                    isDarkMode && styles.optionDark,
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji || '✖️'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Color Selector */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>Color</Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColor,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <MaterialIcons name="check" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Preview */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>Preview</Text>
            <View style={[styles.previewCard, { borderColor: selectedColor }]}>
              <View style={[styles.previewIcon, { backgroundColor: selectedColor + '20' }]}>
                <Text style={styles.previewEmoji}>{selectedEmoji || '📁'}</Text>
              </View>
              <View style={styles.previewContent}>
                <Text style={[styles.previewTitle, isDarkMode && styles.previewTitleDark]}>
                  {spaceName || 'Space Name'}
                </Text>
                {spaceDescription ? (
                  <Text style={[styles.previewDesc, isDarkMode && styles.previewDescDark]} numberOfLines={2}>
                    {spaceDescription}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.updateButton, { backgroundColor: selectedColor }]}
              onPress={handleUpdate}
            >
              <Text style={styles.buttonText}>Update Space</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDelete}
            >
              <MaterialIcons name="delete-outline" size={20} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}>Delete Space</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  })
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#E0E0E0',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#3A3A3C',
  },
  contentContainer: {
    paddingBottom: 120, // Extra padding to ensure delete button is visible above nav bar
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  labelDark: {
    color: '#999',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F5F5F5',
  },
  inputDark: {
    borderColor: '#3A3A3C',
    color: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F5F5F5',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsScroll: {
    flexDirection: 'row',
  },
  emojiOption: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionDark: {
    backgroundColor: '#2C2C2E',
  },
  selectedOption: {
    borderColor: '#007AFF',
  },
  emojiText: {
    fontSize: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#000000',
  },
  previewCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  previewEmoji: {
    fontSize: 24,
  },
  previewContent: {
    flex: 1,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  previewTitleDark: {
    color: '#FFFFFF',
  },
  previewDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  previewDescDark: {
    color: '#999',
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditSpaceSheet;