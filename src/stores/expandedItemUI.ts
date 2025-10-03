import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Item } from '../types';

const STORAGE_KEY = 'expandedItemUI_xVideoMuted';

/**
 * UI state store for managing expanded item sheet visibility and current item
 * This follows the pattern used by chatUI store
 */
export const expandedItemUIStore = observable({
  currentItem: null as Item | null,
  xVideoMuted: true, // Global preference for X video mute state
});

export const expandedItemUIActions = {
  /**
   * Expand a specific item
   */
  expandItem: (item: Item) => {
    console.log('🚀 [expandedItemUIActions] expandItem called for item:', item.id, item.title);
    expandedItemUIStore.currentItem.set(item);
  },

  /**
   * Close the expanded item sheet
   */
  closeExpandedItem: () => {
    console.log('🚀 [expandedItemUIActions] closeExpandedItem called');
    expandedItemUIStore.currentItem.set(null);
  },

  /**
   * Set X video mute preference
   */
  setXVideoMuted: async (muted: boolean) => {
    try {
      // Guard: only update if value actually changed
      const currentValue = expandedItemUIStore.xVideoMuted.get();
      if (currentValue === muted) {
        console.log('🔇 [xVideoMuted] Skipping update - value unchanged:', muted);
        return;
      }

      console.log('🔇 [xVideoMuted] Setting mute preference:', currentValue, '->', muted);
      expandedItemUIStore.xVideoMuted.set(muted);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(muted));
      console.log('🔇 [xVideoMuted] Saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving X video mute preference:', error);
    }
  },

  /**
   * Load X video mute preference from storage
   */
  loadXVideoMutedPreference: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const value = JSON.parse(saved);
        console.log('🔇 [xVideoMuted] Loaded from AsyncStorage:', value);
        expandedItemUIStore.xVideoMuted.set(value);
      } else {
        console.log('🔇 [xVideoMuted] No saved preference, using default: true');
      }
    } catch (error) {
      console.error('Error loading X video mute preference:', error);
    }
  },
};
