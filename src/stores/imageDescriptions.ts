import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageDescription } from '../types';
import { STORAGE_KEYS } from '../constants';
import { syncOperations } from '../services/syncOperations';

interface ImageDescriptionsState {
  descriptions: ImageDescription[];
  isLoading: boolean;
}

const initialState: ImageDescriptionsState = {
  descriptions: [],
  isLoading: false,
};

export const imageDescriptionsStore = observable(initialState);

// Computed values
export const imageDescriptionsComputed = {
  descriptions: () => imageDescriptionsStore.descriptions.get(),
  isLoading: () => imageDescriptionsStore.isLoading.get(),

  // Get all descriptions for an item
  getDescriptionsByItemId: (itemId: string): ImageDescription[] => {
    const descriptions = imageDescriptionsStore.descriptions.get();
    return descriptions.filter(d => d.item_id === itemId);
  },

  // Get description for specific image URL
  getDescriptionForUrl: (itemId: string, imageUrl: string): ImageDescription | null => {
    const descriptions = imageDescriptionsStore.descriptions.get();
    return descriptions.find(d => d.item_id === itemId && d.image_url === imageUrl) || null;
  },

  // Check if item has any descriptions
  hasDescriptions: (itemId: string): boolean => {
    const descriptions = imageDescriptionsStore.descriptions.get();
    return descriptions.some(d => d.item_id === itemId);
  },

  // Get total count of descriptions for an item
  getDescriptionCount: (itemId: string): number => {
    const descriptions = imageDescriptionsStore.descriptions.get();
    return descriptions.filter(d => d.item_id === itemId).length;
  },
};

// Actions
export const imageDescriptionsActions = {
  setDescriptions: async (descriptions: ImageDescription[]) => {
    imageDescriptionsStore.descriptions.set(descriptions);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IMAGE_DESCRIPTIONS, JSON.stringify(descriptions));
    } catch (error) {
      console.error('Error saving image descriptions:', error);
    }
  },

  addDescription: async (description: ImageDescription) => {
    const currentDescriptions = imageDescriptionsStore.descriptions.get();

    // Check if description already exists for this item + image URL
    const existingIndex = currentDescriptions.findIndex(
      d => d.item_id === description.item_id && d.image_url === description.image_url
    );

    let updatedDescriptions: ImageDescription[];
    if (existingIndex !== -1) {
      // Update existing description
      updatedDescriptions = [...currentDescriptions];
      updatedDescriptions[existingIndex] = description;
    } else {
      // Add new description
      updatedDescriptions = [...currentDescriptions, description];
    }

    imageDescriptionsStore.descriptions.set(updatedDescriptions);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IMAGE_DESCRIPTIONS, JSON.stringify(updatedDescriptions));

      // Sync to Supabase
      await syncOperations.uploadImageDescription(description);
    } catch (error) {
      console.error('Error saving image description:', error);
    }
  },

  updateDescription: async (itemId: string, imageUrl: string, updates: Partial<ImageDescription>) => {
    const currentDescriptions = imageDescriptionsStore.descriptions.get();
    const updatedDescriptions = currentDescriptions.map(d =>
      d.item_id === itemId && d.image_url === imageUrl
        ? { ...d, ...updates, updated_at: new Date().toISOString() }
        : d
    );

    imageDescriptionsStore.descriptions.set(updatedDescriptions);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IMAGE_DESCRIPTIONS, JSON.stringify(updatedDescriptions));

      // Find the updated description and sync
      const updatedDescription = updatedDescriptions.find(
        d => d.item_id === itemId && d.image_url === imageUrl
      );
      if (updatedDescription) {
        await syncOperations.uploadImageDescription(updatedDescription);
      }
    } catch (error) {
      console.error('Error updating image description:', error);
    }
  },

  removeDescription: async (itemId: string, imageUrl: string) => {
    const currentDescriptions = imageDescriptionsStore.descriptions.get();
    const filteredDescriptions = currentDescriptions.filter(
      d => !(d.item_id === itemId && d.image_url === imageUrl)
    );

    imageDescriptionsStore.descriptions.set(filteredDescriptions);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IMAGE_DESCRIPTIONS, JSON.stringify(filteredDescriptions));

      // Sync deletion to Supabase
      await syncOperations.deleteImageDescription(itemId, imageUrl);
    } catch (error) {
      console.error('Error removing image description:', error);
    }
  },

  removeDescriptionsByItemId: async (itemId: string) => {
    const currentDescriptions = imageDescriptionsStore.descriptions.get();
    const filteredDescriptions = currentDescriptions.filter(d => d.item_id !== itemId);

    imageDescriptionsStore.descriptions.set(filteredDescriptions);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IMAGE_DESCRIPTIONS, JSON.stringify(filteredDescriptions));

      // Sync deletion to Supabase (delete all for item)
      await syncOperations.deleteImageDescription(itemId);
    } catch (error) {
      console.error('Error removing image descriptions:', error);
    }
  },

  loadDescriptions: async () => {
    try {
      imageDescriptionsStore.isLoading.set(true);
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.IMAGE_DESCRIPTIONS);
      if (saved) {
        const descriptions = JSON.parse(saved) as ImageDescription[];
        imageDescriptionsStore.descriptions.set(descriptions);
        console.log('🖼️  Loaded', descriptions.length, 'image descriptions from storage');
      }
    } catch (error) {
      console.error('Error loading image descriptions:', error);
    } finally {
      imageDescriptionsStore.isLoading.set(false);
    }
  },

  reset: () => {
    imageDescriptionsStore.set(initialState);
  },

  clearAll: async () => {
    imageDescriptionsStore.descriptions.set([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.IMAGE_DESCRIPTIONS);
      console.log('🖼️  Cleared all image descriptions');
    } catch (error) {
      console.error('Error clearing image descriptions:', error);
    }
  },
};

// Load descriptions on app start
imageDescriptionsActions.loadDescriptions();
