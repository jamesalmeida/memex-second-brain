import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

export interface PendingItemDisplay {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  user_id: string;
}

// Observable store for pending items
export const pendingItemsStore = observable({
  items: [] as PendingItemDisplay[],
  isLoading: false,
});

// Actions for managing pending items
export const pendingItemsActions = {
  /**
   * Load pending items from AsyncStorage
   */
  async loadItems() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_ITEMS || '@pending_items');
      if (stored) {
        const items: PendingItemDisplay[] = JSON.parse(stored);

        // Clean up stale items on load (older than 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const cleaned = items.filter(item => {
          const itemDate = new Date(item.created_at);
          const isRecent = itemDate > tenMinutesAgo;

          if (!isRecent) {
            console.log(`🧹 [PendingItems] Removing stale item: ${item.url} (${item.status})`);
            return false;
          }

          return true;
        });

        pendingItemsStore.items.set(cleaned);

        // Save cleaned list back to storage if we removed anything
        if (cleaned.length !== items.length) {
          await AsyncStorage.setItem(
            STORAGE_KEYS.PENDING_ITEMS || '@pending_items',
            JSON.stringify(cleaned)
          );
          console.log(`📥 [PendingItems] Loaded ${cleaned.length} pending items (removed ${items.length - cleaned.length} stale)`);
        } else {
          console.log(`📥 [PendingItems] Loaded ${items.length} pending items from storage`);
        }
      }
    } catch (error) {
      console.error('❌ [PendingItems] Error loading items:', error);
    }
  },

  /**
   * Add a new pending item
   */
  async add(item: PendingItemDisplay) {
    try {
      const current = pendingItemsStore.items.get();

      // Check if item already exists
      if (current.find(i => i.id === item.id)) {
        console.log(`ℹ️ [PendingItems] Item ${item.id} already exists, skipping add`);
        return;
      }

      const updated = [...current, item];
      pendingItemsStore.items.set(updated);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_ITEMS || '@pending_items',
        JSON.stringify(updated)
      );
      console.log(`➕ [PendingItems] Added pending item: ${item.url}`);
    } catch (error) {
      console.error('❌ [PendingItems] Error adding item:', error);
    }
  },

  /**
   * Update the status of a pending item
   */
  async updateStatus(id: string, status: PendingItemDisplay['status'], error_message?: string) {
    try {
      const current = pendingItemsStore.items.get();
      const updated = current.map(item =>
        item.id === id ? { ...item, status, error_message } : item
      );
      pendingItemsStore.items.set(updated);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_ITEMS || '@pending_items',
        JSON.stringify(updated)
      );
      console.log(`🔄 [PendingItems] Updated item ${id} status to: ${status}`);
    } catch (error) {
      console.error('❌ [PendingItems] Error updating status:', error);
    }
  },

  /**
   * Remove a pending item (after completion or failure)
   */
  async remove(id: string) {
    try {
      const current = pendingItemsStore.items.get();
      const updated = current.filter(item => item.id !== id);
      pendingItemsStore.items.set(updated);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_ITEMS || '@pending_items',
        JSON.stringify(updated)
      );
      console.log(`🗑️ [PendingItems] Removed pending item: ${id}`);
    } catch (error) {
      console.error('❌ [PendingItems] Error removing item:', error);
    }
  },

  /**
   * Clear all pending items
   */
  async clearAll() {
    try {
      pendingItemsStore.items.set([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ITEMS || '@pending_items');
      console.log('🗑️ [PendingItems] Cleared all pending items');
    } catch (error) {
      console.error('❌ [PendingItems] Error clearing items:', error);
    }
  },

  /**
   * Remove completed or failed items older than 5 minutes
   */
  async cleanup() {
    try {
      const current = pendingItemsStore.items.get();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const updated = current.filter(item => {
        // Keep pending/processing items regardless of age
        if (item.status === 'pending' || item.status === 'processing') {
          return true;
        }

        // Remove completed/failed items older than 5 minutes
        const itemDate = new Date(item.created_at);
        return itemDate > fiveMinutesAgo;
      });

      if (updated.length !== current.length) {
        pendingItemsStore.items.set(updated);
        await AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_ITEMS || '@pending_items',
          JSON.stringify(updated)
        );
        console.log(`🧹 [PendingItems] Cleaned up ${current.length - updated.length} old items`);
      }
    } catch (error) {
      console.error('❌ [PendingItems] Error during cleanup:', error);
    }
  },

  /**
   * Get count of items by status
   */
  getCounts() {
    const items = pendingItemsStore.items.get();
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      processing: items.filter(i => i.status === 'processing').length,
      completed: items.filter(i => i.status === 'completed').length,
      failed: items.filter(i => i.status === 'failed').length,
    };
  },
};
