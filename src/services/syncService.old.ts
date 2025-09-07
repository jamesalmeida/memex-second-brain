import { supabase, db } from './supabase';
import { itemsStore, itemsActions } from '../stores/items';
import { spacesStore, spacesActions } from '../stores/spaces';
import { itemSpacesStore, itemSpacesActions } from '../stores/itemSpaces';
import { itemMetadataStore, itemMetadataActions } from '../stores/itemMetadata';
import { itemTypeMetadataStore, itemTypeMetadataActions } from '../stores/itemTypeMetadata';
import { offlineQueueStore, offlineQueueActions } from '../stores/offlineQueue';
import { authStore } from '../stores/auth';
import { Item, Space, ItemSpace, ItemMetadata, ItemTypeMetadata, ContentType } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

interface SyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
  timestamp: string;
}

class SyncService {
  private isSyncing = false;
  private syncListeners: ((status: any) => void)[] = [];

  // Track sync status
  private syncStatus = {
    lastSyncTime: null as string | null,
    pendingItems: 0,
    totalSynced: 0,
    isOnline: true,
    isSyncing: false,
    lastError: null as string | null,
  };

  constructor() {
    this.initializeNetworkListener();
  }

  // Initialize network status listener
  private initializeNetworkListener() {
    // Check connection periodically
    setInterval(() => {
      this.checkConnection();
    }, 30000); // Every 30 seconds
  }

  // Check if we have a connection to Supabase
  private async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.auth.getSession();
      const isOnline = !error;
      this.syncStatus.isOnline = isOnline;
      offlineQueueActions.setOnline(isOnline);
      
      if (isOnline && offlineQueueActions.getPendingItems().length > 0) {
        // Auto-sync when coming back online
        this.processOfflineQueue();
      }
      
      return isOnline;
    } catch {
      this.syncStatus.isOnline = false;
      offlineQueueActions.setOnline(false);
      return false;
    }
  }

  // Sync all local items with Supabase
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      itemsSynced: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    if (this.isSyncing) {
      result.errors.push('Sync already in progress');
      result.success = false;
      return result;
    }

    this.isSyncing = true;
    this.syncStatus.isSyncing = true;
    this.notifyListeners();

    try {
      const user = authStore.user.get();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // 1. Get local items
      const localItems = itemsStore.items.get();
      
      // 2. Get remote items
      const { data: remoteItems, error } = await db.getItems(user.id, 1000, 0);
      if (error) throw error;

      // 3. Sync logic
      const localItemsMap = new Map(localItems.map(item => [item.id, item]));
      const remoteItemsMap = new Map((remoteItems || []).map(item => [item.id, item]));

      // Upload local items not in remote
      for (const localItem of localItems) {
        if (!remoteItemsMap.has(localItem.id)) {
          await this.uploadItem(localItem, user.id);
          result.itemsSynced++;
        }
      }

      // Download remote items not in local
      const newItems: Item[] = [];
      for (const remoteItem of (remoteItems || [])) {
        if (!localItemsMap.has(remoteItem.id)) {
          newItems.push(this.convertRemoteToLocal(remoteItem));
        }
      }

      if (newItems.length > 0) {
        const updatedItems = [...localItems, ...newItems];
        await itemsActions.setItems(updatedItems);
        result.itemsSynced += newItems.length;
      }

      // Update sync status
      this.syncStatus.lastSyncTime = new Date().toISOString();
      this.syncStatus.totalSynced = result.itemsSynced;
      await this.saveSyncStatus();

    } catch (error: any) {
      console.error('Sync error:', error);
      result.success = false;
      result.errors.push(error.message);
      this.syncStatus.lastError = error.message;
    } finally {
      this.isSyncing = false;
      this.syncStatus.isSyncing = false;
      this.notifyListeners();
    }

    return result;
  }

  // Upload a single item to Supabase
  async uploadItem(item: Item, userId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      // Add to offline queue with only valid fields
      offlineQueueActions.addToQueue({
        action_type: 'create_item',
        data: {
          id: item.id,
          user_id: userId,
          title: item.title,
          desc: item.desc || null,
          content: item.content || null,
          url: item.url || null,
          thumbnail_url: item.thumbnail_url || null,
          content_type: item.content_type,
          is_archived: item.is_archived || false,
          raw_text: item.raw_text || null,
        },
      });
      return;
    }

    try {
      // Only send fields that exist in the items table
      const { error } = await db.createItem({
        id: item.id,
        user_id: userId,
        title: item.title,
        desc: item.desc || null,
        content: item.content || null,
        url: item.url || null,
        thumbnail_url: item.thumbnail_url || null,
        content_type: item.content_type,
        is_archived: item.is_archived || false,
        raw_text: item.raw_text || null,
      });

      if (error) throw error;
      
      // TODO: Handle metadata separately if needed
      // The author, domain, published_date fields should go in item_metadata table
      
      this.syncStatus.totalSynced++;
      console.log('✅ Item uploaded to Supabase:', item.id);
    } catch (error: any) {
      console.error('Failed to upload item:', error);
      // Add to offline queue for retry with only valid fields
      offlineQueueActions.addToQueue({
        action_type: 'create_item',
        data: {
          id: item.id,
          user_id: userId,
          title: item.title,
          desc: item.desc || null,
          content: item.content || null,
          url: item.url || null,
          thumbnail_url: item.thumbnail_url || null,
          content_type: item.content_type,
          is_archived: item.is_archived || false,
          raw_text: item.raw_text || null,
        },
      });
      throw error;
    }
  }

  // Update an item in Supabase
  async updateItem(itemId: string, updates: Partial<Item>): Promise<void> {
    const user = authStore.user.get();
    if (!user) throw new Error('User not authenticated');

    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      offlineQueueActions.addToQueue({
        action_type: 'update_item',
        data: { id: itemId, ...updates, user_id: user.id },
      });
      return;
    }

    try {
      const { error } = await db.updateItem(itemId, updates);
      if (error) throw error;
      console.log('✅ Item updated in Supabase:', itemId);
    } catch (error: any) {
      console.error('Failed to update item:', error);
      offlineQueueActions.addToQueue({
        action_type: 'update_item',
        data: { id: itemId, ...updates, user_id: user.id },
      });
      throw error;
    }
  }

  // Delete an item from Supabase
  async deleteItem(itemId: string): Promise<void> {
    const user = authStore.user.get();
    if (!user) throw new Error('User not authenticated');

    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      offlineQueueActions.addToQueue({
        action_type: 'delete_item',
        data: { id: itemId, user_id: user.id },
      });
      return;
    }

    try {
      const { error } = await db.deleteItem(itemId);
      if (error) throw error;
      console.log('✅ Item deleted from Supabase:', itemId);
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      offlineQueueActions.addToQueue({
        action_type: 'delete_item',
        data: { id: itemId, user_id: user.id },
      });
      throw error;
    }
  }

  // Process offline queue
  async processOfflineQueue(): Promise<void> {
    const pendingItems = offlineQueueActions.getPendingItems();
    if (pendingItems.length === 0) return;

    console.log(`Processing ${pendingItems.length} offline items...`);
    offlineQueueActions.setSyncing(true);

    for (const queueItem of pendingItems) {
      try {
        switch (queueItem.action_type) {
          case 'create_item':
            await db.createItem(queueItem.data);
            break;
          case 'update_item':
            await db.updateItem(queueItem.data.id, queueItem.data);
            break;
          case 'delete_item':
            await db.deleteItem(queueItem.data.id);
            break;
        }
        
        offlineQueueActions.markAsSynced(queueItem.id);
      } catch (error) {
        console.error('Failed to process queue item:', error);
        offlineQueueActions.markAsFailed(queueItem.id);
      }
    }

    offlineQueueActions.setSyncing(false);
    offlineQueueActions.clearSynced();
  }

  // Convert remote item format to local format
  private convertRemoteToLocal(remoteItem: any): Item {
    return {
      id: remoteItem.id,
      title: remoteItem.title,
      desc: remoteItem.desc,
      content: remoteItem.content,
      url: remoteItem.url,
      thumbnail_url: remoteItem.thumbnail_url,
      video_url: remoteItem.video_url,
      image_urls: remoteItem.image_urls,
      content_type: remoteItem.content_type as ContentType,
      space_ids: remoteItem.item_spaces?.map((is: any) => is.space_id) || [],
      tags: remoteItem.tags,
      is_archived: remoteItem.is_archived,
      created_at: remoteItem.created_at,
      updated_at: remoteItem.updated_at,
      raw_text: remoteItem.raw_text,
      metadata: remoteItem.metadata,
      author: remoteItem.author,
      published_at: remoteItem.published_at,
      domain: remoteItem.domain,
    };
  }

  // Get sync status
  getSyncStatus() {
    return { ...this.syncStatus };
  }

  // Save sync status to AsyncStorage
  private async saveSyncStatus() {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SYNC_STATUS,
        JSON.stringify(this.syncStatus)
      );
    } catch (error) {
      console.error('Failed to save sync status:', error);
    }
  }

  // Load sync status from AsyncStorage
  async loadSyncStatus() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
      if (saved) {
        this.syncStatus = { ...this.syncStatus, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  }

  // Subscribe to sync status changes
  subscribe(listener: (status: any) => void) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of status change
  private notifyListeners() {
    const status = this.getSyncStatus();
    this.syncListeners.forEach(listener => listener(status));
  }
}

// Export singleton instance
export const syncService = new SyncService();