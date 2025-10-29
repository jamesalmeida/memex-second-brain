import React, { useMemo, useState, ReactNode, useRef, useCallback } from 'react';
import { StyleProp, ImageStyle, Alert, Platform, Pressable, View, ActionSheetIOS, Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ImageView from 'react-native-image-viewing';
import * as Haptics from 'expo-haptics';
import { useToast } from '../contexts/ToastContext';

export interface ImageWithActionsProps {
  source: { uri: string } | number;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  placeholder?: any;
  onImageReplace?: () => void;
  canReplace?: boolean;
  canRemove?: boolean;
  onImageRemove?: () => void;
  canAddAnother?: boolean;
  onImageAdd?: () => void;
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
  canAddAnother = false,
  onImageAdd,
  imageUrl,
  children,
  enableFullScreenOnPress = true,
}) => {
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const isRaisedRef = useRef(false);
  const [isRaised, setIsRaised] = useState(false);
  const { showToast } = useToast();

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
      showToast({ message: 'Image URL copied to clipboard', type: 'success' });
    } catch (error) {
      console.error('Error copying URL:', error);
      Alert.alert('Error', 'Failed to copy image URL');
    }
  };

  const handleCopyImage = async () => {
    if (!url) return;

    try {
      // Download image to cache
      const fileUri = `${FileSystem.cacheDirectory}${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error('Failed to download image');
      }

      // Copy image to clipboard
      await Clipboard.setImageAsync(downloadResult.uri);
      showToast({ message: 'Image copied to clipboard', type: 'success' });

      // Clean up cache
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Error copying image:', error);
      Alert.alert('Error', 'Failed to copy image');
    }
  };

  const handleShareImage = async () => {
    if (!url) return;

    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Unavailable', 'Sharing is not available on this device');
        return;
      }

      // Download image to cache
      const fileUri = `${FileSystem.cacheDirectory}${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error('Failed to download image');
      }

      // Share the image
      await Sharing.shareAsync(downloadResult.uri);

      // Clean up cache after sharing
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'Failed to share image');
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

      showToast({ message: 'Image saved to your photo library', type: 'success' });

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

  const liftImage = useCallback(() => {
    if (isRaisedRef.current) return;
    isRaisedRef.current = true;
    setIsRaised(true);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.04,
        friction: 6,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);

  const releaseImage = useCallback(() => {
    if (!isRaisedRef.current) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isRaisedRef.current = false;
      setIsRaised(false);
    });
  }, [scale]);

  const handleAddAnother = () => {
    if (onImageAdd) {
      onImageAdd();
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
      actions.push({ title: 'Copy Image', onPress: handleCopyImage });
      actions.push({ title: 'Copy Image URL', onPress: handleCopyUrl });
      actions.push({ title: 'Share Image', onPress: handleShareImage });
      actions.push({ title: 'Save to Device', onPress: handleSaveToDevice });
    }

    if ((canReplace || onImageReplace) && onImageReplace) {
      actions.push({ title: 'Replace Image', onPress: handleReplace });
    }

    if ((canAddAnother || onImageAdd) && onImageAdd) {
      actions.push({ title: 'Add Another Image', onPress: handleAddAnother });
    }

    if ((canRemove || onImageRemove) && onImageRemove) {
      actions.push({ title: 'Remove Image', onPress: handleRemove, style: 'destructive' });
    }

    return actions;
  }, [url, canReplace, canRemove, canAddAnother, onImageReplace, onImageRemove, onImageAdd]);

  const openActionSheet = () => {
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

  const handleLongPress = useCallback(() => {
    if (!hasContextMenu) {
      return;
    }

    liftImage();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    openActionSheet();
  }, [hasContextMenu, liftImage, openActionSheet]);

  const handlePressOut = useCallback(() => {
    releaseImage();
  }, [releaseImage]);

  return (
    <>
      <Animated.View
        style={[
          styles.wrapper,
          { transform: [{ scale }] },
          isRaised && styles.raised,
        ]}
      >
        <Pressable
          onPress={enableFullScreenOnPress ? handlePrimaryPress : undefined}
          onLongPress={hasContextMenu ? handleLongPress : undefined}
          onPressOut={handlePressOut}
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
      </Animated.View>

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

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
});
