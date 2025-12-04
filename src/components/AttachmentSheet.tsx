import React, { forwardRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import * as ImagePicker from 'expo-image-picker';
import { themeStore } from '../stores/theme';
import { COLORS } from '../constants';
import { useToast } from '../contexts/ToastContext';

interface AttachmentSheetProps {
  onOpen?: () => void;
  onClose?: () => void;
  onPhotoSelected?: (uri: string) => void;
  onFileSelected?: (uri: string) => void;
  onLinkAttach?: () => void;
  onItemsAttach?: () => void;
}

export interface AttachmentSheetRef {
  open: () => void;
  close: () => void;
}

const AttachmentSheet = observer(
  forwardRef<BottomSheet, AttachmentSheetProps>(
    ({ onOpen, onClose, onPhotoSelected, onFileSelected, onLinkAttach, onItemsAttach }, ref) => {
      const isDarkMode = themeStore.isDarkMode.get();
      const { showToast } = useToast();

      // Snap points for the bottom sheet
      const snapPoints = useMemo(() => ['40%'], []);

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

      const handlePickPhoto = async () => {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant photo library access to attach photos.');
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
          });

          if (!result.canceled && result.assets[0]) {
            onPhotoSelected?.(result.assets[0].uri);
            (ref as any)?.current?.close();
          }
        } catch (error) {
          console.error('Error picking photo:', error);
          showToast({
            message: 'Failed to pick photo',
            type: 'error',
            duration: 2000,
          });
        }
      };

      const handleTakePhoto = async () => {
        try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera access to take photos.');
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.8,
          });

          if (!result.canceled && result.assets[0]) {
            onPhotoSelected?.(result.assets[0].uri);
            (ref as any)?.current?.close();
          }
        } catch (error) {
          console.error('Error taking photo:', error);
          showToast({
            message: 'Failed to take photo',
            type: 'error',
            duration: 2000,
          });
        }
      };

      const handleAttachFile = () => {
        // TODO: Implement file picker using expo-document-picker
        showToast({
          message: 'File attachment coming soon!',
          type: 'info',
          duration: 2000,
        });
      };

      const handleAttachLink = () => {
        if (onLinkAttach) {
          onLinkAttach();
        } else {
          // TODO: Show link input dialog
          showToast({
            message: 'Link attachment coming soon!',
            type: 'info',
            duration: 2000,
          });
        }
        (ref as any)?.current?.close();
      };

      const handleAttachItems = () => {
        if (onItemsAttach) {
          onItemsAttach();
        } else {
          showToast({
            message: 'Attach from Memex coming soon!',
            type: 'info',
            duration: 2000,
          });
        }
        (ref as any)?.current?.close();
      };

      return (
        <BottomSheet
          ref={ref}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          topInset={50}
          backgroundStyle={[
            styles.sheetBackground,
            isDarkMode && styles.sheetBackgroundDark,
          ]}
          handleIndicatorStyle={[
            styles.handleIndicator,
            isDarkMode && styles.handleIndicatorDark,
          ]}
          onChange={(index) => {
            if (index === -1) {
              onClose?.();
            } else if (index >= 0) {
              onOpen?.();
            }
          }}
        >
          <View style={styles.header}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>
              Attach
            </Text>
          </View>

          <View style={styles.content}>
            {/* Photo Options */}
            <TouchableOpacity
              style={[styles.optionRow, isDarkMode && styles.optionRowDark]}
              onPress={handlePickPhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: COLORS.primary }]}>
                <MaterialIcons name="photo-library" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                  Choose Photo
                </Text>
                <Text style={[styles.optionSubtitle, isDarkMode && styles.optionSubtitleDark]}>
                  Select from your photo library
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666666' : '#CCCCCC'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionRow, isDarkMode && styles.optionRowDark]}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: COLORS.success }]}>
                <MaterialIcons name="camera-alt" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                  Take Photo
                </Text>
                <Text style={[styles.optionSubtitle, isDarkMode && styles.optionSubtitleDark]}>
                  Use your camera
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666666' : '#CCCCCC'}
              />
            </TouchableOpacity>

            {/* File Option */}
            <TouchableOpacity
              style={[styles.optionRow, isDarkMode && styles.optionRowDark]}
              onPress={handleAttachFile}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: COLORS.warning }]}>
                <MaterialIcons name="attach-file" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                  Attach File
                </Text>
                <Text style={[styles.optionSubtitle, isDarkMode && styles.optionSubtitleDark]}>
                  Documents, PDFs, and more
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666666' : '#CCCCCC'}
              />
            </TouchableOpacity>

            {/* Link Option */}
            <TouchableOpacity
              style={[styles.optionRow, isDarkMode && styles.optionRowDark]}
              onPress={handleAttachLink}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#9B59B6' }]}>
                <MaterialIcons name="link" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                  Attach Link
                </Text>
                <Text style={[styles.optionSubtitle, isDarkMode && styles.optionSubtitleDark]}>
                  Share a URL
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666666' : '#CCCCCC'}
              />
            </TouchableOpacity>

            {/* Items from Memex Option */}
            <TouchableOpacity
              style={[styles.optionRow, styles.lastOptionRow, isDarkMode && styles.optionRowDark]}
              onPress={handleAttachItems}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#3498DB' }]}>
                <MaterialIcons name="inventory-2" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                  From Memex
                </Text>
                <Text style={[styles.optionSubtitle, isDarkMode && styles.optionSubtitleDark]}>
                  Reference your saved items
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666666' : '#CCCCCC'}
              />
            </TouchableOpacity>
          </View>
        </BottomSheet>
      );
    }
  )
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#DDDDDD',
    width: 36,
    height: 4,
  },
  handleIndicatorDark: {
    backgroundColor: '#555555',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  optionRowDark: {
    borderBottomColor: '#38383A',
  },
  lastOptionRow: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  optionTitleDark: {
    color: '#FFFFFF',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  optionSubtitleDark: {
    color: '#999999',
  },
});

export default AttachmentSheet;
