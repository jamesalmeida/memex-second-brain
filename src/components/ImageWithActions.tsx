import React, { useMemo, useState, ReactNode } from 'react';
import { StyleProp, ImageStyle, Alert, Platform, Pressable, View, ActionSheetIOS } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import ImageView from 'react-native-image-viewing';

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
  enableFullScreenOnPress?: boolean;
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
  enableFullScreenOnPress = true,
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
    if (!url) {
      Alert.alert('Unavailable', 'No image available to preview.');
      return;
    }
    requestAnimationFrame(() => {
      setIsViewerVisible(true);
    });
  };

  const handlePrimaryPress = () => {
    if (!enableFullScreenOnPress) {
      return;
    }
    handleViewFullScreen();
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

  const availableActions = useMemo(() => {
    const actions: Array<{
      title: string;
      onPress: () => void;
      style?: 'destructive';
    }> = [];

    if (url) {
      actions.push({ title: 'View Full Screen', onPress: handleViewFullScreen });
      actions.push({ title: 'Copy Image URL', onPress: handleCopyUrl });
      actions.push({ title: 'Save to Device', onPress: handleSaveToDevice });
    }

    if ((canReplace || onImageReplace) && onImageReplace) {
      actions.push({ title: 'Replace Image', onPress: handleReplace });
    }

    if ((canRemove || onImageRemove) && onImageRemove) {
      actions.push({ title: 'Remove Image', onPress: handleRemove, style: 'destructive' });
    }

    return actions;
  }, [url, canReplace, canRemove, onImageReplace, onImageRemove]);

  const showContextMenu = () => {
    if (availableActions.length === 0) {
      return;
    }

    if (Platform.OS === 'ios') {
      const options = [...availableActions.map(action => action.title), 'Cancel'];
      const destructiveIndex = availableActions.findIndex(action => action.style === 'destructive');
      const cancelIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex >= 0 && buttonIndex < availableActions.length) {
            availableActions[buttonIndex].onPress();
          }
        }
      );
    } else {
      const buttons = [
        ...availableActions.map(action => ({
          text: action.title,
          onPress: action.onPress,
          style: action.style,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ];

      Alert.alert('Image Options', undefined, buttons, { cancelable: true });
    }
  };

  const hasContextMenu = availableActions.length > 0;

  return (
    <>
      <Pressable
        onPress={enableFullScreenOnPress ? handlePrimaryPress : undefined}
        onLongPress={hasContextMenu ? showContextMenu : undefined}
        delayLongPress={250}
      >
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
