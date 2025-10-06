import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ItemTypeMetadata } from '../types';
import { STORAGE_KEYS } from '../constants';

interface ItemTypeMetadataState {
  typeMetadata: ItemTypeMetadata[];
  isLoading: boolean;
}

const initialState: ItemTypeMetadataState = {
  typeMetadata: [],
  isLoading: false,
};

export const itemTypeMetadataStore = observable(initialState);

// Computed values
export const itemTypeMetadataComputed = {
  typeMetadata: () => itemTypeMetadataStore.typeMetadata.get(),
  isLoading: () => itemTypeMetadataStore.isLoading.get(),
  
  // Get type metadata for a specific item
  getTypeMetadataForItem: (itemId: string): ItemTypeMetadata | undefined => {
    return itemTypeMetadataStore.typeMetadata.get().find(m => m.item_id === itemId);
  },
  
  // Get video URL for an item
  getVideoUrl: (itemId: string): string | undefined => {
    const metadata = itemTypeMetadataStore.typeMetadata.get().find(m => m.item_id === itemId);
    return metadata?.data?.video_url;
  },
  
  // Get image URLs for an item
  getImageUrls: (itemId: string): string[] | undefined => {
    const metadata = itemTypeMetadataStore.typeMetadata.get().find(m => m.item_id === itemId);
    return metadata?.data?.image_urls;
  },
};

// Actions
export const itemTypeMetadataActions = {
  setTypeMetadata: async (typeMetadata: ItemTypeMetadata[]) => {
    itemTypeMetadataStore.typeMetadata.set(typeMetadata);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_TYPE_METADATA, JSON.stringify(typeMetadata));
    } catch (error) {
      console.error('Error saving item type metadata:', error);
    }
  },

  upsertTypeMetadata: async (metadata: ItemTypeMetadata) => {
    const currentMetadata = itemTypeMetadataStore.typeMetadata.get();
    const existingIndex = currentMetadata.findIndex(m => m.item_id === metadata.item_id);

    let updatedMetadata: ItemTypeMetadata[];
    if (existingIndex >= 0) {
      // Update existing
      updatedMetadata = [...currentMetadata];
      updatedMetadata[existingIndex] = metadata;
    } else {
      // Add new
      updatedMetadata = [...currentMetadata, metadata];
    }

    itemTypeMetadataStore.typeMetadata.set(updatedMetadata);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_TYPE_METADATA, JSON.stringify(updatedMetadata));

      // Sync to Supabase
      const { syncOperations } = await import('../services/syncOperations');
      await syncOperations.upsertItemTypeMetadata(metadata);
    } catch (error) {
      console.error('Error saving item type metadata:', error);
    }
  },

  removeTypeMetadata: async (itemId: string) => {
    const currentMetadata = itemTypeMetadataStore.typeMetadata.get();
    const updatedMetadata = currentMetadata.filter(m => m.item_id !== itemId);

    itemTypeMetadataStore.typeMetadata.set(updatedMetadata);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_TYPE_METADATA, JSON.stringify(updatedMetadata));

      // Sync to Supabase
      const { syncOperations } = await import('../services/syncOperations');
      await syncOperations.deleteItemTypeMetadata(itemId);
    } catch (error) {
      console.error('Error removing item type metadata:', error);
    }
  },

  loadTypeMetadata: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_TYPE_METADATA);
      if (saved) {
        const typeMetadata = JSON.parse(saved) as ItemTypeMetadata[];
        itemTypeMetadataStore.typeMetadata.set(typeMetadata);
        console.log('📚 Loaded', typeMetadata.length, 'item type metadata records');
      }
    } catch (error) {
      console.error('Error loading item type metadata:', error);
    }
  },

  reset: () => {
    itemTypeMetadataStore.set(initialState);
  },
};

// Load type metadata on app start
itemTypeMetadataActions.loadTypeMetadata();