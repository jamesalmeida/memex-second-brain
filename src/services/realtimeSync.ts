import { RealtimeChannel } from '@supabase/supabase-js';
import { subscriptions } from './supabase';
import { authStore } from '../stores/auth';
import { itemsStore } from '../stores/items';
import { spacesStore } from '../stores/spaces';
import { adminSettingsStore } from '../stores/adminSettings';
import { syncService } from './syncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import { Item, Space, AdminSettings, PendingItem } from '../types';
import { toastActions } from '../stores/toast';
import { processingItemsActions } from '../stores/processingItems';
import { pendingItemsActions, pendingItemsStore, PendingItemDisplay } from '../stores/pendingItems';

/**
 * Real-time sync service that listens for changes from other devices
 * and automatically updates the local store
 */
class RealtimeSyncService {
  private itemsChannel: RealtimeChannel | null = null;
  private spacesChannel: RealtimeChannel | null = null;
  private adminSettingsChannel: RealtimeChannel | null = null;
  private pendingItemsChannel: RealtimeChannel | null = null;
  private isActive = false;

  /**
   * Start listening for real-time updates
   */
  async start() {
    const user = authStore.user.get();
    if (!user) {
      console.log('⚠️ [RealtimeSync] No user logged in, skipping real-time setup');
      return;
    }

    if (this.isActive) {
      console.log('⚠️ [RealtimeSync] Already active');
      return;
    }

    console.log('🔴 [RealtimeSync] Starting real-time subscriptions for user:', user.id);

    // Subscribe to items changes
    this.itemsChannel = subscriptions.items(user.id, async (payload) => {
      console.log('📡 [RealtimeSync] Items change received:', payload.eventType, payload.new?.id);
      await this.handleItemChange(payload);
    });

    // Subscribe to spaces changes
    this.spacesChannel = subscriptions.spaces(user.id, async (payload) => {
      console.log('📡 [RealtimeSync] Spaces change received:', payload.eventType, payload.new?.id);
      await this.handleSpaceChange(payload);
    });

    // Subscribe to admin settings changes (global, no user filter)
    this.adminSettingsChannel = subscriptions.adminSettings(async (payload) => {
      console.log('📡 [RealtimeSync] Admin settings change received:', payload.eventType);
      await this.handleAdminSettingsChange(payload);
    });

    // Subscribe to pending items changes (no user filter - client-side filtering in handler)
    this.pendingItemsChannel = subscriptions.pendingItems(async (payload) => {
      console.log('📡 [RealtimeSync] Pending item change received:', payload.eventType, payload.new?.status);
      await this.handlePendingItemChange(payload);
    });

    this.isActive = true;
    console.log('✅ [RealtimeSync] Real-time subscriptions active');
  }

  /**
   * Stop listening for real-time updates
   */
  async stop() {
    console.log('🔴 [RealtimeSync] Stopping real-time subscriptions');

    if (this.itemsChannel) {
      await this.itemsChannel.unsubscribe();
      this.itemsChannel = null;
    }

    if (this.spacesChannel) {
      await this.spacesChannel.unsubscribe();
      this.spacesChannel = null;
    }

    if (this.adminSettingsChannel) {
      await this.adminSettingsChannel.unsubscribe();
      this.adminSettingsChannel = null;
    }

    if (this.pendingItemsChannel) {
      await this.pendingItemsChannel.unsubscribe();
      this.pendingItemsChannel = null;
    }

    this.isActive = false;
    console.log('✅ [RealtimeSync] Real-time subscriptions stopped');
  }

  /**
   * Handle item changes from other devices
   */
  private async handleItemChange(payload: any) {
    const { eventType, new: newItem, old: oldItem } = payload;

    try {
      // Get current items from AsyncStorage
      const itemsData = await AsyncStorage.getItem(STORAGE_KEYS.ITEMS);
      const items: Item[] = itemsData ? JSON.parse(itemsData) : [];

      let updatedItems = [...items];

      switch (eventType) {
        case 'INSERT':
          // Add new item if it doesn't exist locally
          if (!items.find(i => i.id === newItem.id)) {
            console.log('➕ [RealtimeSync] Adding new item:', newItem.id);
            const convertedItem = this.convertRemoteToLocal(newItem);
            updatedItems.push(convertedItem);
          }
          break;

        case 'UPDATE':
          // Update existing item
          console.log('🔄 [RealtimeSync] Updating item:', newItem.id);
          const itemIndex = updatedItems.findIndex(i => i.id === newItem.id);
          if (itemIndex >= 0) {
            updatedItems[itemIndex] = this.convertRemoteToLocal(newItem);
          } else {
            // Item doesn't exist locally, add it
            updatedItems.push(this.convertRemoteToLocal(newItem));
          }
          break;

        case 'DELETE':
          // Mark item as deleted (soft delete)
          console.log('🗑️ [RealtimeSync] Marking item as deleted:', oldItem.id);
          updatedItems = updatedItems.map(item =>
            item.id === oldItem.id
              ? { ...item, is_deleted: true, deleted_at: new Date().toISOString() }
              : item
          );
          break;
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));

      // Update the store (this will trigger UI updates)
      itemsStore.items.set(updatedItems);
      itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));

      console.log('✅ [RealtimeSync] Item change applied locally');
    } catch (error) {
      console.error('❌ [RealtimeSync] Error handling item change:', error);
    }
  }

  /**
   * Handle space changes from other devices
   */
  private async handleSpaceChange(payload: any) {
    const { eventType, new: newSpace, old: oldSpace } = payload;

    try {
      // Get current spaces from AsyncStorage
      const spacesData = await AsyncStorage.getItem(STORAGE_KEYS.SPACES);
      const spaces: Space[] = spacesData ? JSON.parse(spacesData) : [];

      let updatedSpaces = [...spaces];

      switch (eventType) {
        case 'INSERT':
          // Add new space if it doesn't exist locally
          if (!spaces.find(s => s.id === newSpace.id)) {
            console.log('➕ [RealtimeSync] Adding new space:', newSpace.name);
            updatedSpaces.push(newSpace as Space);
          }
          break;

        case 'UPDATE':
          // Update existing space
          console.log('🔄 [RealtimeSync] Updating space:', newSpace.name);
          const spaceIndex = updatedSpaces.findIndex(s => s.id === newSpace.id);
          if (spaceIndex >= 0) {
            const existingSpace = updatedSpaces[spaceIndex];
            const orderChanged = newSpace.order_index !== existingSpace.order_index;

            // Always use the remote data (Supabase is the source of truth)
            updatedSpaces[spaceIndex] = newSpace as Space;

            // If order changed, re-sort the array to reflect new ordering
            if (orderChanged) {
              console.log('🔄 [RealtimeSync] Order changed for space, re-sorting');
              updatedSpaces.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
          } else {
            // Space doesn't exist locally, add it
            updatedSpaces.push(newSpace as Space);
          }
          break;

        case 'DELETE':
          // Mark space as deleted (soft delete)
          console.log('🗑️ [RealtimeSync] Marking space as deleted:', oldSpace.name);
          updatedSpaces = updatedSpaces.map(space =>
            space.id === oldSpace.id
              ? { ...space, is_deleted: true, deleted_at: new Date().toISOString() }
              : space
          );
          break;
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(updatedSpaces));

      // Update the store (this will trigger UI updates)
      spacesStore.spaces.set(updatedSpaces);

      console.log('✅ [RealtimeSync] Space change applied locally');
    } catch (error) {
      console.error('❌ [RealtimeSync] Error handling space change:', error);
    }
  }

  /**
   * Handle admin settings changes from other devices/users
   */
  private async handleAdminSettingsChange(payload: any) {
    const { eventType, new: newSettings } = payload;

    try {
      // Admin settings should only be UPDATE events (single row table)
      // INSERT/DELETE shouldn't happen in normal operation
      if (eventType === 'UPDATE' && newSettings) {
        console.log('🔄 [RealtimeSync] Updating admin settings from remote');

        // Update the store (this will trigger UI updates)
        adminSettingsStore.settings.set(newSettings as AdminSettings);

        // Update AsyncStorage cache
        await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(newSettings));

        console.log('✅ [RealtimeSync] Admin settings change applied locally');
      } else {
        console.log(`ℹ️ [RealtimeSync] Ignoring admin settings ${eventType} event`);
      }
    } catch (error) {
      console.error('❌ [RealtimeSync] Error handling admin settings change:', error);
    }
  }

  /**
   * Handle pending item changes (share extension saves)
   */
  private async handlePendingItemChange(payload: any) {
    const { eventType, new: newPendingItem } = payload;

    try {
      // Client-side filter: only process events for current user
      const currentUserId = authStore.user.get()?.id;
      if (!currentUserId || newPendingItem?.user_id !== currentUserId) {
        console.log('📡 [RealtimeSync] Ignoring pending item for different user');
        return;
      }

      if (eventType === 'INSERT') {
        // Add to pending items store (for banner count)
        console.log('⏳ [RealtimeSync] New pending item created:', newPendingItem.url);
        await pendingItemsActions.add({
          id: newPendingItem.id,
          url: newPendingItem.url,
          status: 'pending',
          created_at: newPendingItem.created_at,
          user_id: newPendingItem.user_id,
          addedAt: Date.now(), // Track when added for minimum banner display time
        });
      } else if (eventType === 'UPDATE' && newPendingItem) {
        const status = newPendingItem.status;

        if (status === 'processing') {
          console.log('⏳ [RealtimeSync] Pending item processing:', newPendingItem.url);
          // Update status in pending items store
          await pendingItemsActions.updateStatus(newPendingItem.id, 'processing');
        } else if (status === 'completed') {
          console.log('✅ [RealtimeSync] Pending item completed:', newPendingItem.url);

          // Get pending item to check minimum banner display time
          const pendingItems = pendingItemsStore.items.get();
          const pendingItem = pendingItems.find(p => p.id === newPendingItem.id);

          // Calculate minimum display time delay (500ms minimum for banner)
          const timeElapsed = pendingItem?.addedAt ? Date.now() - pendingItem.addedAt : 500;
          const delayBeforeRemove = Math.max(0, 500 - timeElapsed);

          console.log(`⏱️ [RealtimeSync] Banner displayed for ${timeElapsed}ms, waiting ${delayBeforeRemove}ms before removal`);

          // Wait for minimum display time, then remove from pending items
          setTimeout(async () => {
            try {
              // Verify item still exists before removing
              const currentItems = pendingItemsStore.items.get();
              if (!currentItems.find(p => p.id === newPendingItem.id)) {
                console.log('⚠️ [RealtimeSync] Item already removed, skipping');
                return;
              }

              await pendingItemsActions.remove(newPendingItem.id);
              console.log('✨ [RealtimeSync] Pending item removed from banner');
              // No need to sync - the real item already arrived via realtime INSERT
            } catch (error) {
              console.error('❌ [RealtimeSync] Error removing pending item:', error);
              // Don't crash - just log the error
            }
          }, delayBeforeRemove);
        } else if (status === 'failed') {
          console.error('❌ [RealtimeSync] Pending item failed:', newPendingItem.error_message);

          // Update status in pending items store
          await pendingItemsActions.updateStatus(newPendingItem.id, 'failed', newPendingItem.error_message);

          // Show error toast
          toastActions.show(
            newPendingItem.error_message || 'Failed to process shared item',
            'error'
          );

          // Remove failed item after 5 seconds
          setTimeout(async () => {
            try {
              // Verify item still exists before removing
              const currentItems = pendingItemsStore.items.get();
              if (!currentItems.find(p => p.id === newPendingItem.id)) {
                console.log('⚠️ [RealtimeSync] Failed item already removed, skipping');
                return;
              }

              await pendingItemsActions.remove(newPendingItem.id);
              console.log('🗑️ [RealtimeSync] Failed item removed from banner');
            } catch (error) {
              console.error('❌ [RealtimeSync] Error removing failed item:', error);
              // Don't crash - just log the error
            }
          }, 5000);
        }
      }
    } catch (error) {
      console.error('❌ [RealtimeSync] Error handling pending item change:', error);
    }
  }

  /**
   * Convert remote Supabase item to local format
   */
  private convertRemoteToLocal(remoteItem: any): Item {
    return {
      ...remoteItem,
      desc: remoteItem.description || remoteItem.desc,
      // Ensure required fields exist
      tags: remoteItem.tags || [],
      is_deleted: remoteItem.is_deleted || false,
    };
  }
}

// Export singleton instance
export const realtimeSyncService = new RealtimeSyncService();
