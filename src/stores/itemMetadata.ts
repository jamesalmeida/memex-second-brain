import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ItemMetadata } from '../types';
import { STORAGE_KEYS } from '../constants';

interface ItemMetadataState {
  metadata: ItemMetadata[];
  isLoading: boolean;
}

const initialState: ItemMetadataState = {
  metadata: [],
  isLoading: false,
};

export const itemMetadataStore = observable(initialState);

// Computed values
export const itemMetadataComputed = {
  metadata: () => itemMetadataStore.metadata.get(),
  isLoading: () => itemMetadataStore.isLoading.get(),
  
  // Get metadata for a specific item
  getMetadataForItem: (itemId: string): ItemMetadata | undefined => {
    return itemMetadataStore.metadata.get().find(m => m.item_id === itemId);
  },
};

// Actions
export const itemMetadataActions = {
  setMetadata: async (metadata: ItemMetadata[]) => {
    itemMetadataStore.metadata.set(metadata);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error saving item metadata:', error);
    }
  },

  upsertMetadata: async (metadata: ItemMetadata) => {
    const currentMetadata = itemMetadataStore.metadata.get();
    const existingIndex = currentMetadata.findIndex(m => m.item_id === metadata.item_id);

    let updatedMetadata: ItemMetadata[];
    if (existingIndex >= 0) {
      // Merge with existing to avoid wiping previously set fields
      updatedMetadata = [...currentMetadata];
      updatedMetadata[existingIndex] = {
        ...currentMetadata[existingIndex],
        ...metadata,
      } as ItemMetadata;
    } else {
      // Add new
      updatedMetadata = [...currentMetadata, metadata];
    }

    itemMetadataStore.metadata.set(updatedMetadata);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_METADATA, JSON.stringify(updatedMetadata));

      // Sync to Supabase with upsert (partial fields only)
      const { syncOperations } = await import('../services/syncOperations');
      await syncOperations.upsertItemMetadata(metadata as any);
    } catch (error) {
      console.error('Error saving item metadata:', error);
    }
  },

  removeMetadata: async (itemId: string) => {
    const currentMetadata = itemMetadataStore.metadata.get();
    const updatedMetadata = currentMetadata.filter(m => m.item_id !== itemId);
    
    itemMetadataStore.metadata.set(updatedMetadata);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_METADATA, JSON.stringify(updatedMetadata));
    } catch (error) {
      console.error('Error removing item metadata:', error);
    }
  },

  loadMetadata: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_METADATA);
      if (saved) {
        const metadata = JSON.parse(saved) as ItemMetadata[];
        itemMetadataStore.metadata.set(metadata);
        console.log('📚 Loaded', metadata.length, 'item metadata records');
      }
    } catch (error) {
      console.error('Error loading item metadata:', error);
    }
  },

  reset: () => {
    itemMetadataStore.set(initialState);
  },
};

// Load metadata on app start
itemMetadataActions.loadMetadata();