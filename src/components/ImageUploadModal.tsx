import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { pickImageFromDevice, uploadImageToStorage, uploadImageFromUrl, validateImageUrl } from '../services/imageUpload';
import { authComputed } from '../stores/auth';

interface ImageUploadModalProps {
  onImageSelected: (imageUrl: string, storagePath?: string) => void;
}

export interface ImageUploadModalHandle {
  open: () => void;
  close: () => void;
}

const ImageUploadModal = observer(forwardRef<ImageUploadModalHandle, ImageUploadModalProps>(({ onImageSelected }, ref) => {
  const isDarkMode = themeStore.isDarkMode.get();

  const [isVisible, setIsVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<'choose' | 'url'>('choose');

  useImperativeHandle(ref, () => ({
    open: () => {
      setMode('choose');
      setUrlInput('');
      setIsVisible(true);
    },
    close: () => {
      setIsVisible(false);
    },
  }), []);

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
      setIsVisible(false);
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
      setIsVisible(false);
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
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContent, isDarkMode && styles.modalContentDark]}
          >
            {/* Header */}
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
              <TouchableOpacity onPress={() => setIsVisible(false)} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                    onPress={() => setMode('url')}
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
                  <TextInput
                    style={[styles.urlInput, isDarkMode && styles.urlInputDark]}
                    placeholder="https://example.com/image.jpg"
                    placeholderTextColor={isDarkMode ? '#666' : '#999'}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    autoFocus
                  />
                  <Text style={[styles.hint, isDarkMode && styles.hintDark]}>
                    Enter the URL of an image you'd like to use
                  </Text>
                  <TouchableOpacity
                    style={[styles.submitButton, (!urlInput.trim() || isUploading) && styles.submitButtonDisabled]}
                    onPress={handleSubmitUrl}
                    disabled={!urlInput.trim() || isUploading}
                  >
                    <Text style={styles.submitButtonText}>Upload from URL</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}));

export default ImageUploadModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '92%',
    maxWidth: 520,
    minWidth: 320,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  closeButton: {
    padding: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    marginRight: 4,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#000000' },
  titleDark: { color: '#FFFFFF' },
  submitButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  scrollContent: { padding: 20 },
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
    // padding handled by scrollContent
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
});
