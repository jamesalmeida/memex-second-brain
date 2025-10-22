import * as ImagePicker from 'expo-image-picker';
import { storage } from './supabase';

const BUCKET_NAME = 'item-images';

export interface ImageUploadResult {
  url: string;
  path: string;
}

/**
 * Request camera roll permissions
 */
export const requestImagePermissions = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
};

/**
 * Pick an image from the device's photo library
 */
export const pickImageFromDevice = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Camera roll permission denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0];
};

/**
 * Upload an image file to Supabase Storage
 */
export const uploadImageToStorage = async (
  uri: string,
  userId: string,
  itemId: string
): Promise<ImageUploadResult> => {
  try {
    // Use fetch to get ArrayBuffer from file:// URI (React Native compatible)
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Get file extension from URI
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    // Create unique file path
    const fileName = `${itemId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await storage.uploadImage(BUCKET_NAME, filePath, fileData, contentType);

    if (error) {
      throw error;
    }

    // Get public URL
    const publicUrl = storage.getPublicUrl(BUCKET_NAME, filePath);

    return {
      url: publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    throw error;
  }
};

/**
 * Delete an image from Supabase Storage
 */
export const deleteImageFromStorage = async (path: string): Promise<void> => {
  try {
    const { error } = await storage.deleteImage(BUCKET_NAME, path);
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting image from storage:', error);
    throw error;
  }
};

/**
 * Validate image URL
 */
export const validateImageUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return response.ok && contentType?.startsWith('image/') === true;
  } catch {
    return false;
  }
};

/**
 * Download image from URL and upload to storage
 */
export const uploadImageFromUrl = async (
  imageUrl: string,
  userId: string,
  itemId: string
): Promise<ImageUploadResult> => {
  try {
    // Validate URL first
    const isValid = await validateImageUrl(imageUrl);
    if (!isValid) {
      throw new Error('Invalid image URL');
    }

    // Fetch image directly as ArrayBuffer
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to download image');
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Get file extension from URL
    const fileExt = imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    // Create unique file path
    const fileName = `${itemId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await storage.uploadImage(BUCKET_NAME, filePath, fileData, contentType);

    if (error) {
      throw error;
    }

    // Get public URL
    const publicUrl = storage.getPublicUrl(BUCKET_NAME, filePath);

    return {
      url: publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('Error uploading image from URL:', error);
    throw error;
  }
};
