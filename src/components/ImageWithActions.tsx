import React, { useState, ReactNode } from 'react';
import { StyleProp, ImageStyle, Alert, Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import ImageView from 'react-native-image-viewing';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';

export interface ImageWithActionsProps {
  source: { uri: string } | number;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  placeholder?: any;
  onImageReplace?: () => void;
  canReplace?: boolean;
  canRemove?: boolean;
  onImageRemove?: () => void;
  imageUrl?: string; // For cases where source is a number (local asset)
  children?: ReactNode;
}

export const ImageWithActions: React.FC<ImageWithActionsProps> = ({
  source,
  style,
  contentFit = 'cover',
  placeholder,
  onImageReplace,
  canReplace = false,
  canRemove = false,
  onImageRemove,
  imageUrl,
  children,
}) => {
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  // Get the actual URL from source
  const getImageUrl = (): string | null => {
    if (imageUrl) return imageUrl;
    if (typeof source === 'object' && 'uri' in source) {
      return source.uri;
    }
    return null;
  };

  const url = getImageUrl();

  const handleViewFullScreen = () => {
    setIsViewerVisible(true);
  };

  const handleCopyUrl = async () => {
    if (!url) return;

    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'Image URL copied to clipboard');
    } catch (error) {
      console.error('Error copying URL:', error);
      Alert.alert('Error', 'Failed to copy image URL');
    }
  };

  const handleSaveToDevice = async () => {
    if (!url) return;

    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant photo library access to save images');
        return;
      }

      // Download image to cache
      const fileUri = `${FileSystem.cacheDirectory}${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error('Failed to download image');
      }

      // Save to media library
      await MediaLibrary.saveToLibraryAsync(downloadResult.uri);

      Alert.alert('Saved', 'Image saved to your photo library');

      // Clean up cache
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image');
    }
  };

  const handleReplace = () => {
    if (onImageReplace) {
      onImageReplace();
    }
  };

  const handleRemove = () => {
    if (onImageRemove) {
      Alert.alert(
        'Remove Image',
        'Are you sure you want to remove this image?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: onImageRemove,
          },
        ]
      );
    }
  };

  return (
    <>
      <Host>
        <ContextMenu>
          <ContextMenu.Trigger>
            <Pressable onPress={handleViewFullScreen}>
              <View>
                <Image
                  source={source}
                  style={style}
                  contentFit={contentFit}
                  placeholder={placeholder}
                />
                {children}
              </View>
            </Pressable>
          </ContextMenu.Trigger>

          <ContextMenu.Items>
            <Button onPress={handleViewFullScreen}>
              View Full Screen
            </Button>

            {url && (
              <>
                <Button onPress={handleCopyUrl}>
                  Copy Image URL
                </Button>

                <Button onPress={handleSaveToDevice}>
                  Save to Device
                </Button>
              </>
            )}

            {canReplace && onImageReplace && (
              <Button onPress={handleReplace}>
                Replace Image
              </Button>
            )}

            {canRemove && onImageRemove && (
              <Button onPress={handleRemove}>
                Remove Image
              </Button>
            )}
          </ContextMenu.Items>
        </ContextMenu>
      </Host>

      {url && (
        <ImageView
          images={[{ uri: url }]}
          imageIndex={0}
          visible={isViewerVisible}
          onRequestClose={() => setIsViewerVisible(false)}
        />
      )}
    </>
  );
};
