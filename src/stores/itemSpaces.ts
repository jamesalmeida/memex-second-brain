import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ItemSpace } from '../types';
import { STORAGE_KEYS } from '../constants';
import { syncService } from '../services/syncService';
import { spacesActions } from './spaces';

interface ItemSpacesState {
  itemSpaces: ItemSpace[];
  isLoading: boolean;
}

const initialState: ItemSpacesState = {
  itemSpaces: [],
  isLoading: false,
};

export const itemSpacesStore = observable(initialState);

// Computed values
export const itemSpacesComputed = {
  itemSpaces: () => itemSpacesStore.itemSpaces.get(),
  isLoading: () => itemSpacesStore.isLoading.get(),
  
  // Get all space IDs for an item
  getSpaceIdsForItem: (itemId: string): string[] => {
    return itemSpacesStore.itemSpaces.get()
      .filter(is => is.item_id === itemId)
      .map(is => is.space_id);
  },
  
  // Get all item IDs in a space
  getItemIdsInSpace: (spaceId: string): string[] => {
    return itemSpacesStore.itemSpaces.get()
      .filter(is => is.space_id === spaceId)
      .map(is => is.item_id);
  },
  
  // Check if an item is in a space
  isItemInSpace: (itemId: string, spaceId: string): boolean => {
    return itemSpacesStore.itemSpaces.get()
      .some(is => is.item_id === itemId && is.space_id === spaceId);
  },
};

// Actions
export const itemSpacesActions = {
  setItemSpaces: async (itemSpaces: ItemSpace[]) => {
    itemSpacesStore.itemSpaces.set(itemSpaces);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(itemSpaces));
    } catch (error) {
      console.error('Error saving item spaces:', error);
    }
  },

  addItemToSpace: async (itemId: string, spaceId: string) => {
    // Check if relationship already exists
    if (itemSpacesComputed.isItemInSpace(itemId, spaceId)) {
      return;
    }
    
    const newRelation: ItemSpace = {
      item_id: itemId,
      space_id: spaceId,
      created_at: new Date().toISOString(),
    };
    
    const currentItemSpaces = itemSpacesStore.itemSpaces.get();
    const updatedItemSpaces = [...currentItemSpaces, newRelation];
    
    itemSpacesStore.itemSpaces.set(updatedItemSpaces);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(updatedItemSpaces));
      
      // Sync to Supabase
      await syncService.addItemToSpace(itemId, spaceId);
      
      // Update local item count for the space
      const itemsInSpace = itemSpacesComputed.getItemIdsInSpace(spaceId).length;
      spacesActions.updateSpace(spaceId, { item_count: itemsInSpace });
    } catch (error) {
      console.error('Error saving item space relation:', error);
    }
  },

  removeItemFromSpace: async (itemId: string, spaceId: string) => {
    const currentItemSpaces = itemSpacesStore.itemSpaces.get();
    const updatedItemSpaces = currentItemSpaces.filter(
      is => !(is.item_id === itemId && is.space_id === spaceId)
    );
    
    itemSpacesStore.itemSpaces.set(updatedItemSpaces);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(updatedItemSpaces));
      
      // Sync deletion to Supabase
      await syncService.removeItemFromSpace(itemId, spaceId);
      
      // Update local item count for the space
      const itemsInSpace = updatedItemSpaces.filter(is => is.space_id === spaceId).length;
      spacesActions.updateSpace(spaceId, { item_count: itemsInSpace });
    } catch (error) {
      console.error('Error removing item space relation:', error);
    }
  },

  removeAllItemRelations: async (itemId: string) => {
    const currentItemSpaces = itemSpacesStore.itemSpaces.get();
    const updatedItemSpaces = currentItemSpaces.filter(is => is.item_id !== itemId);
    
    itemSpacesStore.itemSpaces.set(updatedItemSpaces);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(updatedItemSpaces));
    } catch (error) {
      console.error('Error removing item relations:', error);
    }
  },

  removeAllSpaceRelations: async (spaceId: string) => {
    const currentItemSpaces = itemSpacesStore.itemSpaces.get();
    const updatedItemSpaces = currentItemSpaces.filter(is => is.space_id !== spaceId);
    
    itemSpacesStore.itemSpaces.set(updatedItemSpaces);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(updatedItemSpaces));
    } catch (error) {
      console.error('Error removing space relations:', error);
    }
  },

  updateItemSpaces: async (itemId: string, spaceIds: string[]) => {
    // Remove all existing relations for this item
    const currentItemSpaces = itemSpacesStore.itemSpaces.get();
    const otherRelations = currentItemSpaces.filter(is => is.item_id !== itemId);
    
    // Add new relations
    const newRelations: ItemSpace[] = spaceIds.map(spaceId => ({
      item_id: itemId,
      space_id: spaceId,
      created_at: new Date().toISOString(),
    }));
    
    const updatedItemSpaces = [...otherRelations, ...newRelations];
    
    itemSpacesStore.itemSpaces.set(updatedItemSpaces);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(updatedItemSpaces));
    } catch (error) {
      console.error('Error updating item spaces:', error);
    }
  },

  loadItemSpaces: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_SPACES);
      if (saved) {
        const itemSpaces = JSON.parse(saved) as ItemSpace[];
        itemSpacesStore.itemSpaces.set(itemSpaces);
        console.log('📚 Loaded', itemSpaces.length, 'item-space relationships');
      }
    } catch (error) {
      console.error('Error loading item spaces:', error);
    }
  },

  reset: () => {
    itemSpacesStore.set(initialState);
  },
};

// Load item spaces on app start
itemSpacesActions.loadItemSpaces();