import { supabase, db } from './supabase';
import { itemsStore, itemsActions } from '../stores/items';
import { spacesStore, spacesActions } from '../stores/spaces';
import { itemSpacesStore, itemSpacesActions } from '../stores/itemSpaces';
import { itemMetadataStore, itemMetadataActions } from '../stores/itemMetadata';
import { itemTypeMetadataStore, itemTypeMetadataActions } from '../stores/itemTypeMetadata';
import { videoTranscriptsStore, videoTranscriptsActions } from '../stores/videoTranscripts';
import { offlineQueueStore, offlineQueueActions } from '../stores/offlineQueue';
import { authStore } from '../stores/auth';
import { Item, Space, ItemSpace, ItemMetadata, ItemTypeMetadata, ContentType, VideoTranscript } from '../types';
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
        // Process offline queue when coming back online
        this.processOfflineQueue();
      }
      
      return isOnline;
    } catch {
      this.syncStatus.isOnline = false;
      offlineQueueActions.setOnline(false);
      return false;
    }
  }

  // Main sync method - syncs all tables
  async syncToCloud(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      itemsSynced: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    if (this.isSyncing) {
      console.log('Already syncing...');
      return result;
    }

    const user = authStore.user.get();
    if (!user) {
      result.errors.push('No user logged in');
      result.success = false;
      return result;
    }

    this.isSyncing = true;
    this.syncStatus.isSyncing = true;
    this.notifyListeners();

    try {
      // First, process offline queue
      await this.processOfflineQueue();

      // Sync all tables in order
      console.log('🔄 Starting full sync...');
      
      // 1. Sync spaces first (items depend on spaces)
      console.log('📦 Syncing spaces...');
      await this.syncSpaces(user.id);
      
      // 2. Sync items
      console.log('📝 Syncing items...');
      const itemsSynced = await this.syncItems(user.id);
      result.itemsSynced += itemsSynced;
      
      // 3. Sync item_spaces relationships
      console.log('🔗 Syncing item-space relationships...');
      await this.syncItemSpaces(user.id);
      
      // 4. Sync item metadata
      console.log('📊 Syncing item metadata...');
      await this.syncItemMetadata(user.id);
      
      // 5. Sync item type metadata
      console.log('🎨 Syncing item type metadata...');
      await this.syncItemTypeMetadata(user.id);
      
      // 6. Sync video transcripts
      console.log('📝 Syncing video transcripts...');
      await this.syncVideoTranscripts(user.id);

      console.log('✅ Sync completed successfully');

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

  // Sync spaces table
  private async syncSpaces(userId: string): Promise<void> {
    const localSpaces = spacesStore.spaces.get();
    console.log(`📦 Found ${localSpaces.length} local spaces to sync`);
    console.log('Local spaces:', localSpaces.map(s => ({ id: s.id, name: s.name, user_id: s.user_id })));
    
    const { data: remoteSpaces, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching remote spaces:', error);
      throw error;
    }

    console.log(`📦 Found ${remoteSpaces?.length || 0} remote spaces`);

    const localSpacesMap = new Map(localSpaces.map(space => [space.id, space]));
    const remoteSpacesMap = new Map((remoteSpaces || []).map(space => [space.id, space]));

    // Upload local spaces not in remote
    for (const localSpace of localSpaces) {
      if (!remoteSpacesMap.has(localSpace.id)) {
        console.log(`📤 Uploading space: ${localSpace.name} (${localSpace.id})`);
        const { error } = await supabase
          .from('spaces')
          .insert({
            id: localSpace.id,
            user_id: userId,
            name: localSpace.name,
            description: localSpace.description || localSpace.desc || null,
            color: localSpace.color,
            item_count: localSpace.item_count || 0,
            created_at: localSpace.created_at || new Date().toISOString(),
            updated_at: localSpace.updated_at || new Date().toISOString(),
          });
        if (error) {
          console.error(`❌ Error uploading space ${localSpace.name}:`, error);
        } else {
          console.log(`✅ Successfully uploaded space: ${localSpace.name}`);
        }
      }
    }

    // Download remote spaces not in local
    const newSpaces: Space[] = [];
    for (const remoteSpace of (remoteSpaces || [])) {
      if (!localSpacesMap.has(remoteSpace.id)) {
        newSpaces.push(remoteSpace as Space);
      }
    }

    if (newSpaces.length > 0) {
      await spacesActions.setSpaces([...localSpaces, ...newSpaces]);
    }
  }

  // Sync items table
  private async syncItems(userId: string): Promise<number> {
    let itemsSynced = 0;
    
    // Get local items and filter out invalid UUIDs
    const allLocalItems = itemsStore.items.get();
    
    // UUID regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Filter out items with invalid UUIDs (mock items)
    const localItems = allLocalItems.filter(item => uuidRegex.test(item.id));
    
    // Remove invalid items from local storage
    const invalidItems = allLocalItems.filter(item => !uuidRegex.test(item.id));
    if (invalidItems.length > 0) {
      console.log(`🧹 Removing ${invalidItems.length} items with invalid UUIDs`);
      await itemsActions.setItems(localItems);
    }
    
    // Get remote items
    const { data: remoteItems, error } = await db.getItems(userId);
    if (error) throw error;

    // Create maps for efficient lookup
    const localItemsMap = new Map(localItems.map(item => [item.id, item]));
    const remoteItemsMap = new Map((remoteItems || []).map(item => [item.id, item]));

    // Upload local items not in remote
    for (const localItem of localItems) {
      if (!remoteItemsMap.has(localItem.id)) {
        await this.uploadItem(localItem, userId);
        itemsSynced++;
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
      itemsSynced += newItems.length;
    }

    return itemsSynced;
  }

  // Sync item_spaces relationships
  private async syncItemSpaces(userId: string): Promise<void> {
    const localItemSpaces = itemSpacesStore.itemSpaces.get();
    
    // Get all item IDs for this user to filter item_spaces
    const { data: userItems } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId);
    
    if (!userItems || userItems.length === 0) return;
    const userItemIds = userItems.map(item => item.id);
    
    const { data: remoteItemSpaces, error } = await supabase
      .from('item_spaces')
      .select('*')
      .in('item_id', userItemIds);
    
    if (error) throw error;

    const localMap = new Map(localItemSpaces.map(is => [`${is.item_id}_${is.space_id}`, is]));
    const remoteMap = new Map((remoteItemSpaces || []).map(is => [`${is.item_id}_${is.space_id}`, is]));

    // Upload local relationships not in remote
    for (const localIS of localItemSpaces) {
      const key = `${localIS.item_id}_${localIS.space_id}`;
      if (!remoteMap.has(key)) {
        const { error } = await supabase
          .from('item_spaces')
          .insert({
            item_id: localIS.item_id,
            space_id: localIS.space_id,
          });
        if (error) console.error('Error uploading item_space:', error);
      }
    }

    // Download remote relationships not in local
    const newItemSpaces: ItemSpace[] = [];
    for (const remoteIS of (remoteItemSpaces || [])) {
      const key = `${remoteIS.item_id}_${remoteIS.space_id}`;
      if (!localMap.has(key)) {
        newItemSpaces.push(remoteIS as ItemSpace);
      }
    }

    if (newItemSpaces.length > 0) {
      await itemSpacesActions.setItemSpaces([...localItemSpaces, ...newItemSpaces]);
    }
  }

  // Sync item metadata
  private async syncItemMetadata(userId: string): Promise<void> {
    const localMetadata = itemMetadataStore.metadata.get();
    
    // Get all item IDs for this user
    const { data: userItems } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId);
    
    if (!userItems || userItems.length === 0) return;
    const userItemIds = userItems.map(item => item.id);
    
    const { data: remoteMetadata, error } = await supabase
      .from('item_metadata')
      .select('*')
      .in('item_id', userItemIds);
    
    if (error) throw error;

    const localMap = new Map(localMetadata.map(m => [m.item_id, m]));
    const remoteMap = new Map((remoteMetadata || []).map(m => [m.item_id, m]));

    // Upload local metadata not in remote
    for (const localM of localMetadata) {
      if (!remoteMap.has(localM.item_id)) {
        const { error } = await supabase
          .from('item_metadata')
          .insert(localM);
        if (error) console.error('Error uploading item_metadata:', error);
      }
    }

    // Download remote metadata not in local
    const newMetadata: ItemMetadata[] = [];
    for (const remoteM of (remoteMetadata || [])) {
      if (!localMap.has(remoteM.item_id)) {
        newMetadata.push(remoteM as ItemMetadata);
      }
    }

    if (newMetadata.length > 0) {
      await itemMetadataActions.setMetadata([...localMetadata, ...newMetadata]);
    }
  }

  // Sync item type metadata
  private async syncItemTypeMetadata(userId: string): Promise<void> {
    const localTypeMetadata = itemTypeMetadataStore.typeMetadata.get();
    
    // Get all item IDs for this user
    const { data: userItems } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId);
    
    if (!userItems || userItems.length === 0) return;
    const userItemIds = userItems.map(item => item.id);
    
    const { data: remoteTypeMetadata, error } = await supabase
      .from('item_type_metadata')
      .select('*')
      .in('item_id', userItemIds);
    
    if (error) throw error;

    const localMap = new Map(localTypeMetadata.map(m => [m.item_id, m]));
    const remoteMap = new Map((remoteTypeMetadata || []).map(m => [m.item_id, m]));

    // Upload local type metadata not in remote
    for (const localTM of localTypeMetadata) {
      if (!remoteMap.has(localTM.item_id)) {
        // Ensure content_type is included
        if (!localTM.content_type) {
          console.warn(`⚠️ Skipping type metadata for item ${localTM.item_id} - missing content_type`);
          continue;
        }
        
        const { error } = await supabase
          .from('item_type_metadata')
          .insert({
            item_id: localTM.item_id,
            content_type: localTM.content_type,
            data: localTM.data || {},
          });
        if (error) console.error('Error uploading item_type_metadata:', error);
      }
    }

    // Download remote type metadata not in local
    const newTypeMetadata: ItemTypeMetadata[] = [];
    for (const remoteTM of (remoteTypeMetadata || [])) {
      if (!localMap.has(remoteTM.item_id)) {
        newTypeMetadata.push(remoteTM as ItemTypeMetadata);
      }
    }

    if (newTypeMetadata.length > 0) {
      await itemTypeMetadataActions.setTypeMetadata([...localTypeMetadata, ...newTypeMetadata]);
    }
  }

  // Sync video transcripts
  private async syncVideoTranscripts(userId: string): Promise<void> {
    const localTranscripts = videoTranscriptsStore.transcripts.get();
    
    // Get all item IDs for this user to filter transcripts
    const { data: userItems } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId);
    
    if (!userItems || userItems.length === 0) return;
    const userItemIds = userItems.map(item => item.id);
    
    const { data: remoteTranscripts, error } = await supabase
      .from('video_transcripts')
      .select('*')
      .in('item_id', userItemIds);
    
    if (error) {
      console.error('Error fetching video transcripts:', error);
      return;
    }

    const localMap = new Map(localTranscripts.map(t => [t.item_id, t]));
    const remoteMap = new Map((remoteTranscripts || []).map(t => [t.item_id, t]));

    // Upload local transcripts not in remote
    for (const localT of localTranscripts) {
      if (!remoteMap.has(localT.item_id)) {
        const { error } = await db.saveVideoTranscript({
          item_id: localT.item_id,
          transcript: localT.transcript,
          platform: localT.platform,
          language: localT.language,
          duration: localT.duration,
        });
        if (error) console.error('Error uploading video transcript:', error);
      }
    }

    // Download remote transcripts not in local
    const newTranscripts: VideoTranscript[] = [];
    for (const remoteT of (remoteTranscripts || [])) {
      if (!localMap.has(remoteT.item_id)) {
        newTranscripts.push(remoteT as VideoTranscript);
      }
    }

    if (newTranscripts.length > 0) {
      await videoTranscriptsActions.setTranscripts([...localTranscripts, ...newTranscripts]);
    }
  }

  // Upload a single video transcript to Supabase
  async uploadVideoTranscript(transcript: VideoTranscript): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      // Add to offline queue
      offlineQueueActions.addToQueue({
        action_type: 'save_video_transcript',
        data: transcript,
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      const { error } = await db.saveVideoTranscript({
        item_id: transcript.item_id,
        transcript: transcript.transcript,
        platform: transcript.platform,
        language: transcript.language,
        duration: transcript.duration,
      });
      
      if (error) throw error;
      console.log(`✅ Uploaded video transcript for item ${transcript.item_id}`);
    } catch (error: any) {
      console.error('Error uploading video transcript:', error);
      // Add to offline queue if upload fails
      offlineQueueActions.addToQueue({
        action_type: 'save_video_transcript',
        data: transcript,
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }
  
  // Delete video transcript from Supabase
  async deleteVideoTranscript(itemId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      // Add to offline queue
      offlineQueueActions.addToQueue({
        action_type: 'delete_video_transcript',
        data: { item_id: itemId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      const { error } = await db.deleteVideoTranscript(itemId);
      if (error) throw error;
      console.log(`✅ Deleted video transcript for item ${itemId}`);
    } catch (error: any) {
      console.error('Error deleting video transcript:', error);
      // Add to offline queue if delete fails
      offlineQueueActions.addToQueue({
        action_type: 'delete_video_transcript',
        data: { item_id: itemId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }

  // Upload a single item to Supabase
  async uploadItem(item: Item, userId: string): Promise<void> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(item.id)) {
      console.log(`⚠️ Skipping item with invalid UUID: ${item.id}`);
      return;
    }
    
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
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
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
    } catch (error: any) {
      console.error('Error uploading item:', error);
      // Add to offline queue if upload fails
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
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }

  // Convert remote item to local format
  private convertRemoteToLocal(remoteItem: any): Item {
    return {
      id: remoteItem.id,
      user_id: remoteItem.user_id,
      title: remoteItem.title,
      desc: remoteItem.desc,
      content: remoteItem.content,
      url: remoteItem.url,
      thumbnail_url: remoteItem.thumbnail_url,
      content_type: remoteItem.content_type as ContentType,
      is_archived: remoteItem.is_archived || false,
      raw_text: remoteItem.raw_text,
      created_at: remoteItem.created_at,
      updated_at: remoteItem.updated_at,
    };
  }

  // Process offline queue
  private async processOfflineQueue() {
    const allPendingItems = offlineQueueActions.getPendingItems();
    
    // UUID regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Filter out items with invalid UUIDs
    const pendingItems = allPendingItems.filter(queueItem => {
      if (queueItem.action_type === 'create_item' || queueItem.action_type === 'update_item') {
        const isValid = uuidRegex.test(queueItem.data.id);
        if (!isValid) {
          console.log(`⚠️ Removing queue item with invalid UUID: ${queueItem.data.id}`);
          offlineQueueActions.removeFromQueue(queueItem.id);
          return false;
        }
      }
      return true;
    });
    
    console.log(`Processing ${pendingItems.length} offline items...`);
    
    // Update pending count in sync status
    this.syncStatus.pendingItems = pendingItems.length;
    this.notifyListeners();
    
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
        
        // Remove from queue on success
        offlineQueueActions.removeFromQueue(queueItem.id);
        
        // Update pending count
        this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
        this.notifyListeners();
      } catch (error) {
        console.error('Error processing offline item:', error);
        // Keep in queue if processing fails
      }
    }
  }

  // Add listener for sync status changes
  addListener(listener: (status: any) => void) {
    this.syncListeners.push(listener);
  }

  // Remove listener
  removeListener(listener: (status: any) => void) {
    this.syncListeners = this.syncListeners.filter(l => l !== listener);
  }

  // Notify all listeners
  private notifyListeners() {
    this.syncListeners.forEach(listener => listener(this.syncStatus));
  }

  // Save sync status to storage
  private async saveSyncStatus() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(this.syncStatus));
    } catch (error) {
      console.error('Error saving sync status:', error);
    }
  }

  // Load sync status from storage
  async loadSyncStatus() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
      if (saved) {
        this.syncStatus = { ...this.syncStatus, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  }

  // Get current sync status
  getSyncStatus() {
    return this.syncStatus;
  }

  // Upload a single space to Supabase
  async uploadSpace(space: Space, userId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      console.log('📵 Offline - space will sync later');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('spaces')
        .insert({
          id: space.id,
          user_id: userId,
          name: space.name,
          description: space.description || space.desc || null,
          color: space.color,
          item_count: space.item_count || 0,
          created_at: space.created_at || new Date().toISOString(),
          updated_at: space.updated_at || new Date().toISOString(),
        });
      
      if (error) throw error;
      console.log(`✅ Created space ${space.name} in Supabase`);
    } catch (error: any) {
      console.error('Error creating space in Supabase:', error);
      throw error;
    }
  }

  // Delete item from Supabase
  async deleteItem(itemId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      // Add to offline queue
      offlineQueueActions.addToQueue({
        action_type: 'delete_item',
        data: { id: itemId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      const { error } = await db.deleteItem(itemId);
      if (error) throw error;
      console.log(`✅ Deleted item ${itemId} from Supabase`);
    } catch (error: any) {
      console.error('Error deleting item from Supabase:', error);
      // Add to offline queue if delete fails
      offlineQueueActions.addToQueue({
        action_type: 'delete_item',
        data: { id: itemId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }
  
  // Update item in Supabase
  async updateItem(itemId: string, updates: Partial<Item>): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      // Add to offline queue
      offlineQueueActions.addToQueue({
        action_type: 'update_item',
        data: { id: itemId, ...updates },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      const { error } = await db.updateItem(itemId, updates);
      if (error) throw error;
      console.log(`✅ Updated item ${itemId} in Supabase`);
    } catch (error: any) {
      console.error('Error updating item in Supabase:', error);
      // Add to offline queue if update fails
      offlineQueueActions.addToQueue({
        action_type: 'update_item',
        data: { id: itemId, ...updates },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }

  // Add item to space (sync relationship)
  async addItemToSpace(itemId: string, spaceId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      // Add to offline queue
      offlineQueueActions.addToQueue({
        action_type: 'add_item_to_space',
        data: { item_id: itemId, space_id: spaceId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      const { error } = await supabase
        .from('item_spaces')
        .insert({
          item_id: itemId,
          space_id: spaceId,
        });
      
      if (error) throw error;
      console.log(`✅ Added item ${itemId} to space ${spaceId} in Supabase`);
      
      // Update space item count
      await this.updateSpaceItemCount(spaceId);
    } catch (error: any) {
      console.error('Error adding item to space in Supabase:', error);
      // Add to offline queue if fails
      offlineQueueActions.addToQueue({
        action_type: 'add_item_to_space',
        data: { item_id: itemId, space_id: spaceId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }
  
  // Remove item from space (sync relationship deletion)
  async removeItemFromSpace(itemId: string, spaceId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      // Add to offline queue
      offlineQueueActions.addToQueue({
        action_type: 'remove_item_from_space',
        data: { item_id: itemId, space_id: spaceId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      const { error } = await supabase
        .from('item_spaces')
        .delete()
        .eq('item_id', itemId)
        .eq('space_id', spaceId);
      
      if (error) throw error;
      console.log(`✅ Removed item ${itemId} from space ${spaceId} in Supabase`);
      
      // Update space item count
      await this.updateSpaceItemCount(spaceId);
    } catch (error: any) {
      console.error('Error removing item from space in Supabase:', error);
      // Add to offline queue if fails
      offlineQueueActions.addToQueue({
        action_type: 'remove_item_from_space',
        data: { item_id: itemId, space_id: spaceId },
      });
      
      // Update pending count
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }
  
  // Update space item count
  async updateSpaceItemCount(spaceId: string): Promise<void> {
    try {
      // Get count of items in this space
      const { count, error: countError } = await supabase
        .from('item_spaces')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId);
      
      if (countError) throw countError;
      
      // Update space with new count
      const { error: updateError } = await supabase
        .from('spaces')
        .update({ 
          item_count: count || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', spaceId);
      
      if (updateError) throw updateError;
      
      console.log(`✅ Updated space ${spaceId} item count to ${count}`);
      
      // Update local space store too
      spacesActions.updateSpace(spaceId, { item_count: count || 0 });
    } catch (error: any) {
      console.error('Error updating space item count:', error);
    }
  }

  // Force sync now
  async forceSync(): Promise<SyncResult> {
    console.log('Force sync triggered');
    return this.syncToCloud();
  }
}

export const syncService = new SyncService();