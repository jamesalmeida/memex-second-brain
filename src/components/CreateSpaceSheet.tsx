import React, { forwardRef, useMemo, useCallback, useState } from 'react';
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
import { observer } from '@legendapp/state/react';
import uuid from 'react-native-uuid';
import { themeStore } from '../stores/theme';
import { spacesActions } from '../stores/spaces';
import { authComputed } from '../stores/auth';
import { Space } from '../types';

interface CreateSpaceSheetProps {
  onSpaceCreated?: (space: Space) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

// Emoji picker removed - no longer needed
const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#DDA0DD',
  '#FF8C94', '#98D8C8', '#6C5CE7', '#55A3FF', '#FD79A8', '#A29BFE',
];

const CreateSpaceSheet = observer(
  forwardRef<BottomSheet, CreateSpaceSheetProps>(({ onSpaceCreated, onOpen, onClose }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const [spaceName, setSpaceName] = useState('');
    const [spaceDescription, setSpaceDescription] = useState('');
    // Emoji selection removed
    const [selectedColor, setSelectedColor] = useState('#4ECDC4');
    
    // Snap points for the bottom sheet - single snap point to prevent sheet closing
    const snapPoints = useMemo(() => ['90%'], []);

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

    const handleCreate = async () => {
      if (!spaceName.trim()) {
        Alert.alert('Error', 'Please enter a space name');
        return;
      }

      const userId = authComputed.userId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const newSpace: Space = {
        id: uuid.v4() as string,
        name: spaceName.trim(),
        description: spaceDescription.trim(),
        color: selectedColor,
        // icon field removed - no emoji selection
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId,
      };

      await spacesActions.addSpaceWithSync(newSpace);
      onSpaceCreated?.(newSpace);
      
      // Reset form
      setSpaceName('');
      setSpaceDescription('');
      // emoji reset removed
      setSelectedColor('#4ECDC4');
      
      // Close sheet
      (ref as any)?.current?.close();
    };

    const handleCancel = () => {
      setSpaceName('');
      setSpaceDescription('');
      // emoji reset removed
      setSelectedColor('#4ECDC4');
      (ref as any)?.current?.close();
    };

    return (
      <BottomSheet
        ref={ref}
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
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={(index) => {
          if (index === -1) {
            onClose?.();
          } else if (index >= 0) {
            onOpen?.();
          }
        }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={[styles.headerButton, styles.cancelButton]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Create New Space
          </Text>
          <TouchableOpacity onPress={handleCreate}>
            <Text style={[styles.headerButton, styles.createButton]}>Create</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Space Name */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>
              SPACE NAME
            </Text>
            <BottomSheetTextInput
              style={[styles.input, isDarkMode && styles.inputDark]}
              placeholder="Enter space name"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={spaceName}
              onChangeText={setSpaceName}
              autoCapitalize="words"
              maxLength={50}
            />
          </View>

          {/* Emoji Selection removed */}

          {/* Color Selection */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>
              CHOOSE A COLOR
            </Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>
              DESCRIPTION (OPTIONAL)
            </Text>
            <BottomSheetTextInput
              style={[styles.textArea, isDarkMode && styles.inputDark]}
              placeholder="What's this space for?"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={spaceDescription}
              onChangeText={setSpaceDescription}
              multiline
              numberOfLines={4}
              maxLength={200}
              textAlignVertical="top"
              scrollEnabled={false}
              blurOnSubmit={false}
            />
          </View>

          {/* Preview */}
          <View style={styles.section}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>
              PREVIEW
            </Text>
            <View style={[styles.previewCard, isDarkMode && styles.previewCardDark]}>
              <View style={styles.previewContent}>
                <Text style={[styles.previewName, isDarkMode && styles.previewNameDark]}>
                  {spaceName || 'Space Name'}
                </Text>
                {spaceDescription ? (
                  <Text style={[styles.previewDescription, isDarkMode && styles.previewDescriptionDark]}>
                    {spaceDescription}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  })
);

export default CreateSpaceSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#D1D1D6',
    width: 36,
  },
  handleIndicatorDark: {
    backgroundColor: '#48484A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  headerButton: {
    fontSize: 17,
  },
  cancelButton: {
    color: '#999',
  },
  createButton: {
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    padding: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  labelDark: {
    color: '#999',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFF',
    borderColor: '#3A3A3C',
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Emoji-related styles removed
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
  colorOptionSelected: {
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  checkmark: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: 'bold',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewCardDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  // Preview icon styles removed
  previewContent: {
    flex: 1,
    marginLeft: 0, // No icon to offset from
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  previewNameDark: {
    color: '#FFF',
  },
  previewDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  previewDescriptionDark: {
    color: '#999',
  },
});