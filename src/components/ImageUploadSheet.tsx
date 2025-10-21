import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Keyboard, Platform, InputAccessoryView, Button } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { pickImageFromDevice, uploadImageToStorage, uploadImageFromUrl, validateImageUrl } from '../services/imageUpload';
import { authComputed } from '../stores/auth';

interface ImageUploadSheetProps {
  onImageSelected: (imageUrl: string, storagePath?: string) => void;
}

export interface ImageUploadSheetHandle {
  open: () => void;
  close: () => void;
}

const ImageUploadSheet = observer(forwardRef<ImageUploadSheetHandle, ImageUploadSheetProps>(({ onImageSelected }, ref) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<'choose' | 'url'>('choose');

  const snapPoints = useMemo(() => ['35%', '50%'], []);

  useImperativeHandle(ref, () => ({
    open: () => {
      setMode('choose');
      setUrlInput('');
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }), []);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
  );

  const handlePickFromDevice = async () => {
    try {
      setIsUploading(true);

      const image = await pickImageFromDevice();
      if (!image) {
        setIsUploading(false);
        return;
      }

      const userId = authComputed.userId();
      if (!userId) {
        Alert.alert('Error', 'You must be signed in to upload images');
        setIsUploading(false);
        return;
      }

      // For now, use a temporary item ID. This will be replaced when integrated with actual items
      const tempItemId = 'temp-' + Date.now();

      const result = await uploadImageToStorage(image.uri, userId, tempItemId);

      onImageSelected(result.url, result.path);
      bottomSheetRef.current?.close();
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitUrl = async () => {
    const url = urlInput.trim();
    if (!url) {
      Alert.alert('Error', 'Please enter an image URL');
      return;
    }

    try {
      setIsUploading(true);

      // Check if it's a valid image URL
      const isValid = await validateImageUrl(url);
      if (!isValid) {
        Alert.alert('Error', 'Invalid image URL. Please make sure the URL points to an image.');
        setIsUploading(false);
        return;
      }

      const userId = authComputed.userId();
      if (!userId) {
        Alert.alert('Error', 'You must be signed in to upload images');
        setIsUploading(false);
        return;
      }

      // For now, use a temporary item ID
      const tempItemId = 'temp-' + Date.now();

      // Download and re-upload to our storage
      const result = await uploadImageFromUrl(url, userId, tempItemId);

      onImageSelected(result.url, result.path);
      bottomSheetRef.current?.close();
    } catch (error: any) {
      console.error('Error uploading from URL:', error);
      Alert.alert('Error', error.message || 'Failed to upload image from URL');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackToChoose = () => {
    setMode('choose');
    setUrlInput('');
    Keyboard.dismiss();
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBackground, isDarkMode && styles.sheetBackgroundDark]}
      handleIndicatorStyle={[styles.handleIndicator, isDarkMode && styles.handleIndicatorDark]}
      keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
      keyboardBlurBehavior="restore"
      onChange={(index) => {
        if (index === -1) {
          setMode('choose');
          setUrlInput('');
        }
      }}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {mode === 'url' && (
            <TouchableOpacity onPress={handleBackToChoose} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            {mode === 'choose' ? 'Choose Image' : 'Enter Image URL'}
          </Text>
        </View>
        {mode === 'url' && (
          <TouchableOpacity
            style={[styles.submitButton, (!urlInput.trim() || isUploading) && styles.submitButtonDisabled]}
            onPress={handleSubmitUrl}
            disabled={!urlInput.trim() || isUploading}
          >
            <Text style={styles.submitButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {isUploading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
              Uploading image...
            </Text>
          </View>
        ) : mode === 'choose' ? (
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.option, isDarkMode && styles.optionDark]}
              onPress={handlePickFromDevice}
            >
              <View style={[styles.optionIcon, isDarkMode && styles.optionIconDark]}>
                <MaterialIcons name="photo-library" size={28} color="#FF6B35" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                  Choose from Device
                </Text>
                <Text style={[styles.optionDescription, isDarkMode && styles.optionDescriptionDark]}>
                  Pick an image from your photo library
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? '#666' : '#CCC'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, isDarkMode && styles.optionDark]}
              onPress={() => {
                setMode('url');
                bottomSheetRef.current?.expand();
              }}
            >
              <View style={[styles.optionIcon, isDarkMode && styles.optionIconDark]}>
                <MaterialIcons name="link" size={28} color="#FF6B35" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                  Enter Image URL
                </Text>
                <Text style={[styles.optionDescription, isDarkMode && styles.optionDescriptionDark]}>
                  Paste a link to an image online
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? '#666' : '#CCC'} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.urlInputContainer}>
            <BottomSheetTextInput
              style={[styles.urlInput, isDarkMode && styles.urlInputDark]}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputAccessoryViewID={Platform.OS === 'ios' ? 'imageUrlAccessory' : undefined}
            />
            <Text style={[styles.hint, isDarkMode && styles.hintDark]}>
              Enter the URL of an image you'd like to use
            </Text>
          </View>
        )}
      </BottomSheetScrollView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="imageUrlAccessory">
          <View style={styles.inputAccessory}>
            <Button title="Done" onPress={Keyboard.dismiss} />
          </View>
        </InputAccessoryView>
      )}
    </BottomSheet>
  );
}));

export default ImageUploadSheet;

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: '#FFFFFF' },
  sheetBackgroundDark: { backgroundColor: '#1C1C1E' },
  handleIndicator: { backgroundColor: '#CCCCCC', width: 40 },
  handleIndicatorDark: { backgroundColor: '#666666' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    marginRight: 4,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#000000' },
  titleDark: { color: '#FFFFFF' },
  submitButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  scrollContent: { paddingBottom: 24 },
  loadingContainer: {
    paddingTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  loadingTextDark: {
    color: '#AAA',
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  optionDark: {
    backgroundColor: '#2C2C2E',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconDark: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  optionTitleDark: {
    color: '#FFFFFF',
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
  },
  optionDescriptionDark: {
    color: '#AAA',
  },
  urlInputContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  urlInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
  },
  urlInputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginLeft: 4,
  },
  hintDark: {
    color: '#AAA',
  },
  inputAccessory: {
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
  },
});
