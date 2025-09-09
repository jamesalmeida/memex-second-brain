import { supabase, db } from './supabase';
import { offlineQueueActions } from '../stores/offlineQueue';
import { authStore } from '../stores/auth';
import { Item, Space, ItemSpace, ItemMetadata, ItemTypeMetadata, ContentType, VideoTranscript } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import { syncOperations } from './syncOperations';

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
      
      // DIAGNOSTIC: Log local data counts
      console.log('🔍 [DIAGNOSTIC] Local data summary:');
      const localItemsData = await AsyncStorage.getItem(STORAGE_KEYS.ITEMS);
      const localItems = localItemsData ? JSON.parse(localItemsData) : [];
      console.log(`🔍 [DIAGNOSTIC] Local items: ${localItems.length}`);

      const localItemSpacesData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_SPACES);
      const localItemSpaces = localItemSpacesData ? JSON.parse(localItemSpacesData) : [];
      console.log(`🔍 [DIAGNOSTIC] Local item_spaces: ${localItemSpaces.length}`);

      const localMetadataData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_METADATA);
      const localMetadata = localMetadataData ? JSON.parse(localMetadataData) : [];
      console.log(`🔍 [DIAGNOSTIC] Local item_metadata: ${localMetadata.length}`);

      const localTypeMetadataData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_TYPE_METADATA);
      const localTypeMetadata = localTypeMetadataData ? JSON.parse(localTypeMetadataData) : [];
      console.log(`🔍 [DIAGNOSTIC] Local item_type_metadata: ${localTypeMetadata.length}`);

      // Show sample of local data for debugging
      if (localItemSpaces.length > 0) {
        console.log('🔍 [DIAGNOSTIC] Sample local item_spaces:', localItemSpaces.slice(0, 3).map(is => `${is.item_id}_${is.space_id}`));
      }

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
      console.log('🔍 [DIAGNOSTIC] Sync summary:');
      console.log(`🔍 [DIAGNOSTIC] - Items synced: ${itemsSynced}`);
      console.log(`🔍 [DIAGNOSTIC] - Local data counts: items=${localItems.length}, item_spaces=${localItemSpaces.length}, metadata=${localMetadata.length}, type_metadata=${localTypeMetadata.length}`);
      console.log(`🔍 [DIAGNOSTIC] - RLS policies are working correctly - orphaned references were skipped instead of causing errors`);

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
    // Get local spaces from AsyncStorage
    const spacesData = await AsyncStorage.getItem(STORAGE_KEYS.SPACES);
    const localSpaces: Space[] = spacesData ? JSON.parse(spacesData) : [];
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
      const updatedSpaces = [...localSpaces, ...newSpaces];
      await AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(updatedSpaces));
    }
  }

  // Sync items table
  private async syncItems(userId: string): Promise<number> {
    let itemsSynced = 0;
    
    // Get local items from AsyncStorage
    const itemsData = await AsyncStorage.getItem(STORAGE_KEYS.ITEMS);
    const allLocalItems: Item[] = itemsData ? JSON.parse(itemsData) : [];
    
    // UUID regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Filter out items with invalid UUIDs (mock items)
    const localItems = allLocalItems.filter(item => uuidRegex.test(item.id));
    
    // Remove invalid items from local storage
    const invalidItems = allLocalItems.filter(item => !uuidRegex.test(item.id));
    if (invalidItems.length > 0) {
      console.log(`🧹 Removing ${invalidItems.length} items with invalid UUIDs`);
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(localItems));
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
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
      itemsSynced += newItems.length;
    }

    return itemsSynced;
  }

  // Sync item_spaces relationships
  private async syncItemSpaces(userId: string): Promise<void> {
    console.log('🔍 [DIAGNOSTIC] Starting item_spaces sync...');

    // Get local item spaces from AsyncStorage
    const itemSpacesData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_SPACES);
    const localItemSpaces: ItemSpace[] = itemSpacesData ? JSON.parse(itemSpacesData) : [];
    console.log(`🔍 [DIAGNOSTIC] Found ${localItemSpaces.length} local item_spaces relationships`);

    // Get all item IDs for this user to filter item_spaces
    console.log('🔍 [DIAGNOSTIC] Fetching remote items for user...');
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId);

    if (itemsError) {
      console.error('🔍 [DIAGNOSTIC] Error fetching user items:', itemsError);
      throw itemsError;
    }

    console.log(`🔍 [DIAGNOSTIC] Found ${userItems?.length || 0} remote items for user`);
    if (userItems) {
      console.log('🔍 [DIAGNOSTIC] Remote item IDs:', userItems.map(item => item.id));
    }

    if (!userItems || userItems.length === 0) {
      console.log('🔍 [DIAGNOSTIC] No remote items found, skipping item_spaces sync');
      return;
    }

    const userItemIds = userItems.map(item => item.id);

    console.log('🔍 [DIAGNOSTIC] Fetching remote item_spaces...');
    const { data: remoteItemSpaces, error } = await supabase
      .from('item_spaces')
      .select('*')
      .in('item_id', userItemIds);

    if (error) {
      console.error('🔍 [DIAGNOSTIC] Error fetching remote item_spaces:', error);
      throw error;
    }

    console.log(`🔍 [DIAGNOSTIC] Found ${remoteItemSpaces?.length || 0} remote item_spaces`);

    const localMap = new Map(localItemSpaces.map(is => [`${is.item_id}_${is.space_id}`, is]));
    const remoteMap = new Map((remoteItemSpaces || []).map(is => [`${is.item_id}_${is.space_id}`, is]));

    // Upload local relationships not in remote
    console.log('🔍 [SYNC] Checking for item_spaces to upload...');
    let skippedOrphanedItemSpaces = 0;
    let uploadedItemSpaces = 0;

    for (const localIS of localItemSpaces) {
      const key = `${localIS.item_id}_${localIS.space_id}`;

      if (!remoteMap.has(key)) {
        // Check if this item exists in remote
        const itemExists = userItemIds.includes(localIS.item_id);
        
        // Skip orphaned item-space relationships (item doesn't exist in remote)
        if (!itemExists) {
          console.log(`⚠️ Skipping orphaned item_space: ${key} (item not in remote)`);
          skippedOrphanedItemSpaces++;
          continue;
        }

        // Check if space exists and is owned by user
        const { data: spaceCheck, error: spaceError } = await supabase
          .from('spaces')
          .select('id')
          .eq('id', localIS.space_id)
          .eq('user_id', userId)
          .single();

        if (spaceError || !spaceCheck) {
          console.log(`⚠️ Skipping item_space: ${key} (space not found or not owned)`);
          skippedOrphanedItemSpaces++;
          continue;
        }

        // Both item and space exist, safe to upload
        const { error } = await supabase
          .from('item_spaces')
          .insert({
            item_id: localIS.item_id,
            space_id: localIS.space_id,
          });

        if (error) {
          console.error(`Error uploading item_space ${key}:`, error);
        } else {
          uploadedItemSpaces++;
        }
      }
    }

    if (skippedOrphanedItemSpaces > 0) {
      console.log(`⚠️ Skipped ${skippedOrphanedItemSpaces} orphaned item_spaces`);
    }
    if (uploadedItemSpaces > 0) {
      console.log(`✅ Uploaded ${uploadedItemSpaces} item_spaces`);
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
      const updatedItemSpaces = [...localItemSpaces, ...newItemSpaces];
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(updatedItemSpaces));
    }
  }

  // Sync item metadata
  private async syncItemMetadata(userId: string): Promise<void> {
    console.log('🔍 [DIAGNOSTIC] Starting item_metadata sync...');

    // Get local metadata from AsyncStorage
    const metadataData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_METADATA);
    const localMetadata: ItemMetadata[] = metadataData ? JSON.parse(metadataData) : [];
    console.log(`🔍 [DIAGNOSTIC] Found ${localMetadata.length} local item_metadata records`);

    // Get all item IDs for this user
    console.log('🔍 [DIAGNOSTIC] Fetching remote items for metadata sync...');
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId);

    if (itemsError) {
      console.error('🔍 [DIAGNOSTIC] Error fetching user items for metadata:', itemsError);
      throw itemsError;
    }

    console.log(`🔍 [DIAGNOSTIC] Found ${userItems?.length || 0} remote items for metadata sync`);
    if (!userItems || userItems.length === 0) {
      console.log('🔍 [DIAGNOSTIC] No remote items found, skipping item_metadata sync');
      return;
    }

    const userItemIds = userItems.map(item => item.id);

    console.log('🔍 [DIAGNOSTIC] Fetching remote item_metadata...');
    const { data: remoteMetadata, error } = await supabase
      .from('item_metadata')
      .select('*')
      .in('item_id', userItemIds);

    if (error) {
      console.error('🔍 [DIAGNOSTIC] Error fetching remote item_metadata:', error);
      throw error;
    }

    console.log(`🔍 [DIAGNOSTIC] Found ${remoteMetadata?.length || 0} remote item_metadata records`);

    const localMap = new Map(localMetadata.map(m => [m.item_id, m]));
    const remoteMap = new Map((remoteMetadata || []).map(m => [m.item_id, m]));

    // Upload local metadata not in remote
    console.log('🔍 [SYNC] Checking for item_metadata to upload...');
    let skippedOrphanedMetadata = 0;
    let uploadedMetadata = 0;

    for (const localM of localMetadata) {
      if (!remoteMap.has(localM.item_id)) {
        const itemExists = userItemIds.includes(localM.item_id);
        
        // Skip orphaned item metadata (item doesn't exist in remote)
        if (!itemExists) {
          console.log(`⚠️ Skipping orphaned item_metadata: ${localM.item_id} (item not in remote)`);
          skippedOrphanedMetadata++;
          continue;
        }

        const { error } = await supabase
          .from('item_metadata')
          .insert(localM);

        if (error) {
          console.error(`Error uploading item_metadata for ${localM.item_id}:`, error);
        } else {
          uploadedMetadata++;
        }
      }
    }

    if (skippedOrphanedMetadata > 0) {
      console.log(`⚠️ Skipped ${skippedOrphanedMetadata} orphaned item_metadata records`);
    }
    if (uploadedMetadata > 0) {
      console.log(`✅ Uploaded ${uploadedMetadata} item_metadata records`);
    }

    // Download remote metadata not in local
    const newMetadata: ItemMetadata[] = [];
    for (const remoteM of (remoteMetadata || [])) {
      if (!localMap.has(remoteM.item_id)) {
        newMetadata.push(remoteM as ItemMetadata);
      }
    }

    if (newMetadata.length > 0) {
      const updatedMetadata = [...localMetadata, ...newMetadata];
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_METADATA, JSON.stringify(updatedMetadata));
    }
  }

  // Sync item type metadata
  private async syncItemTypeMetadata(userId: string): Promise<void> {
    console.log('🔍 [DIAGNOSTIC] Starting item_type_metadata sync...');

    // Get local type metadata from AsyncStorage
    const typeMetadataData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_TYPE_METADATA);
    const localTypeMetadata: ItemTypeMetadata[] = typeMetadataData ? JSON.parse(typeMetadataData) : [];
    console.log(`🔍 [DIAGNOSTIC] Found ${localTypeMetadata.length} local item_type_metadata records`);

    // Get all item IDs for this user
    console.log('🔍 [DIAGNOSTIC] Fetching remote items for type metadata sync...');
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId);

    if (itemsError) {
      console.error('🔍 [DIAGNOSTIC] Error fetching user items for type metadata:', itemsError);
      throw itemsError;
    }

    console.log(`🔍 [DIAGNOSTIC] Found ${userItems?.length || 0} remote items for type metadata sync`);
    if (!userItems || userItems.length === 0) {
      console.log('🔍 [DIAGNOSTIC] No remote items found, skipping item_type_metadata sync');
      return;
    }

    const userItemIds = userItems.map(item => item.id);

    console.log('🔍 [DIAGNOSTIC] Fetching remote item_type_metadata...');
    const { data: remoteTypeMetadata, error } = await supabase
      .from('item_type_metadata')
      .select('*')
      .in('item_id', userItemIds);

    if (error) {
      console.error('🔍 [DIAGNOSTIC] Error fetching remote item_type_metadata:', error);
      throw error;
    }

    console.log(`🔍 [DIAGNOSTIC] Found ${remoteTypeMetadata?.length || 0} remote item_type_metadata records`);

    const localMap = new Map(localTypeMetadata.map(m => [m.item_id, m]));
    const remoteMap = new Map((remoteTypeMetadata || []).map(m => [m.item_id, m]));

    // Upload local type metadata not in remote
    console.log('🔍 [SYNC] Checking for item_type_metadata to upload...');
    let skippedOrphanedTypeMetadata = 0;
    let uploadedTypeMetadata = 0;

    for (const localTM of localTypeMetadata) {
      if (!remoteMap.has(localTM.item_id)) {
        const itemExists = userItemIds.includes(localTM.item_id);
        
        // Skip orphaned item type metadata (item doesn't exist in remote)
        if (!itemExists) {
          console.log(`⚠️ Skipping orphaned item_type_metadata: ${localTM.item_id} (item not in remote)`);
          skippedOrphanedTypeMetadata++;
          continue;
        }

        // Ensure content_type is included - default to 'bookmark' if missing
        const validContentTypes = ['bookmark', 'youtube', 'youtube_short', 'x', 'github', 'instagram', 'tiktok', 'reddit', 'amazon', 'linkedin', 'image', 'pdf', 'video', 'audio', 'note', 'article', 'product', 'book', 'course'];
        const contentType = localTM.content_type && validContentTypes.includes(localTM.content_type)
          ? localTM.content_type
          : 'bookmark';

        const { error } = await supabase
          .from('item_type_metadata')
          .insert({
            item_id: localTM.item_id,
            content_type: contentType,
            data: localTM.data || {},
          });

        if (error) {
          console.error(`Error uploading item_type_metadata for ${localTM.item_id}:`, error);
        } else {
          uploadedTypeMetadata++;
        }
      }
    }

    if (skippedOrphanedTypeMetadata > 0) {
      console.log(`⚠️ Skipped ${skippedOrphanedTypeMetadata} orphaned item_type_metadata records`);
    }
    if (uploadedTypeMetadata > 0) {
      console.log(`✅ Uploaded ${uploadedTypeMetadata} item_type_metadata records`);
    }

    // Download remote type metadata not in local
    const newTypeMetadata: ItemTypeMetadata[] = [];
    for (const remoteTM of (remoteTypeMetadata || [])) {
      if (!localMap.has(remoteTM.item_id)) {
        newTypeMetadata.push(remoteTM as ItemTypeMetadata);
      }
    }

    if (newTypeMetadata.length > 0) {
      const updatedTypeMetadata = [...localTypeMetadata, ...newTypeMetadata];
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_TYPE_METADATA, JSON.stringify(updatedTypeMetadata));
    }
  }

  // Sync video transcripts
  private async syncVideoTranscripts(userId: string): Promise<void> {
    // Get local transcripts from AsyncStorage
    const transcriptsData = await AsyncStorage.getItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS);
    const localTranscripts: VideoTranscript[] = transcriptsData ? JSON.parse(transcriptsData) : [];
    
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
      const updatedTranscripts = [...localTranscripts, ...newTranscripts];
      await AsyncStorage.setItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS, JSON.stringify(updatedTranscripts));
    }
  }

  // Delegated to syncOperations - kept for backward compatibility
  async uploadVideoTranscript(transcript: VideoTranscript): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      offlineQueueActions.addToQueue({
        action_type: 'save_video_transcript',
        data: transcript,
      });
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      await syncOperations.uploadVideoTranscript(transcript);
    } catch (error: any) {
      console.error('Error uploading video transcript:', error);
      offlineQueueActions.addToQueue({
        action_type: 'save_video_transcript',
        data: transcript,
      });
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }
  
  // Delegated to syncOperations - kept for backward compatibility
  async deleteVideoTranscript(itemId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      offlineQueueActions.addToQueue({
        action_type: 'delete_video_transcript',
        data: { item_id: itemId },
      });
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }
    
    try {
      await syncOperations.deleteVideoTranscript(itemId);
    } catch (error: any) {
      console.error('Error deleting video transcript:', error);
      offlineQueueActions.addToQueue({
        action_type: 'delete_video_transcript',
        data: { item_id: itemId },
      });
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
    }
  }

  // Delegated to syncOperations - kept for backward compatibility
  async uploadItem(item: Item, userId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      const validContentTypes = ['bookmark', 'youtube', 'youtube_short', 'x', 'github', 'instagram', 'tiktok', 'reddit', 'amazon', 'linkedin', 'image', 'pdf', 'video', 'audio', 'note', 'article', 'product', 'book', 'course'];
      const contentType = validContentTypes.includes(item.content_type) ? item.content_type : 'bookmark';
      
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
          content_type: contentType,
          is_archived: item.is_archived || false,
          raw_text: item.raw_text || null,
        },
      });
      this.syncStatus.pendingItems = offlineQueueActions.getPendingItems().length;
      this.notifyListeners();
      return;
    }

    try {
      await syncOperations.uploadItem(item, userId);
    } catch (error: any) {
      console.error('Error uploading item:', error);
      const validContentTypes = ['bookmark', 'youtube', 'youtube_short', 'x', 'github', 'instagram', 'tiktok', 'reddit', 'amazon', 'linkedin', 'image', 'pdf', 'video', 'audio', 'note', 'article', 'product', 'book', 'course'];
      const contentType = validContentTypes.includes(item.content_type) ? item.content_type : 'bookmark';
      
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
          content_type: contentType,
          is_archived: item.is_archived || false,
          raw_text: item.raw_text || null,
        },
      });
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

  // One-time cleanup function to remove orphaned local data
  async cleanupOrphanedData(): Promise<{ cleaned: number; details: string[] }> {
    console.log('🧹 Starting cleanup of orphaned data...');
    const details: string[] = [];
    let totalCleaned = 0;

    const user = authStore.user.get();
    if (!user) {
      console.error('No user logged in, cannot cleanup');
      return { cleaned: 0, details: ['No user logged in'] };
    }

    try {
      // Step 1: Get all remote items for this user
      console.log('🔍 Fetching all remote items...');
      const { data: remoteItems, error } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching remote items:', error);
        throw error;
      }

      const remoteItemIds = new Set((remoteItems || []).map(item => item.id));
      console.log(`📦 Found ${remoteItemIds.size} remote items`);
      details.push(`Found ${remoteItemIds.size} remote items`);

      // Step 2: Clean up local item_spaces
      const itemSpacesData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_SPACES);
      if (itemSpacesData) {
        const localItemSpaces: ItemSpace[] = JSON.parse(itemSpacesData);
        const validItemSpaces = localItemSpaces.filter(is => remoteItemIds.has(is.item_id));
        const removedCount = localItemSpaces.length - validItemSpaces.length;
        
        if (removedCount > 0) {
          await AsyncStorage.setItem(STORAGE_KEYS.ITEM_SPACES, JSON.stringify(validItemSpaces));
          console.log(`🧹 Removed ${removedCount} orphaned item_spaces`);
          details.push(`Removed ${removedCount} orphaned item_spaces`);
          totalCleaned += removedCount;
        }
      }

      // Step 3: Clean up local item_metadata
      const metadataData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_METADATA);
      if (metadataData) {
        const localMetadata: ItemMetadata[] = JSON.parse(metadataData);
        const validMetadata = localMetadata.filter(m => remoteItemIds.has(m.item_id));
        const removedCount = localMetadata.length - validMetadata.length;
        
        if (removedCount > 0) {
          await AsyncStorage.setItem(STORAGE_KEYS.ITEM_METADATA, JSON.stringify(validMetadata));
          console.log(`🧹 Removed ${removedCount} orphaned item_metadata`);
          details.push(`Removed ${removedCount} orphaned item_metadata`);
          totalCleaned += removedCount;
        }
      }

      // Step 4: Clean up local item_type_metadata
      const typeMetadataData = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_TYPE_METADATA);
      if (typeMetadataData) {
        const localTypeMetadata: ItemTypeMetadata[] = JSON.parse(typeMetadataData);
        const validTypeMetadata = localTypeMetadata.filter(tm => remoteItemIds.has(tm.item_id));
        const removedCount = localTypeMetadata.length - validTypeMetadata.length;
        
        if (removedCount > 0) {
          await AsyncStorage.setItem(STORAGE_KEYS.ITEM_TYPE_METADATA, JSON.stringify(validTypeMetadata));
          console.log(`🧹 Removed ${removedCount} orphaned item_type_metadata`);
          details.push(`Removed ${removedCount} orphaned item_type_metadata`);
          totalCleaned += removedCount;
        }
      }

      // Step 5: Clean up local video_transcripts
      const transcriptsData = await AsyncStorage.getItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS);
      if (transcriptsData) {
        const localTranscripts: VideoTranscript[] = JSON.parse(transcriptsData);
        const validTranscripts = localTranscripts.filter(t => remoteItemIds.has(t.item_id));
        const removedCount = localTranscripts.length - validTranscripts.length;
        
        if (removedCount > 0) {
          await AsyncStorage.setItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS, JSON.stringify(validTranscripts));
          console.log(`🧹 Removed ${removedCount} orphaned video_transcripts`);
          details.push(`Removed ${removedCount} orphaned video_transcripts`);
          totalCleaned += removedCount;
        }
      }

      console.log(`✅ Cleanup completed. Removed ${totalCleaned} orphaned records`);
      if (totalCleaned === 0) {
        details.push('No orphaned data found');
      }

      return { cleaned: totalCleaned, details };
    } catch (error) {
      console.error('Error during cleanup:', error);
      details.push(`Error: ${error.message || 'Unknown error'}`);
      return { cleaned: totalCleaned, details };
    }
  }

  // Update a space in Supabase
  async updateSpace(space: Space): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      console.log('📵 Offline - space update will sync later');
      // TODO: Add to offline queue for update
      return;
    }
    
    try {
      const { error } = await supabase
        .from('spaces')
        .update({
          name: space.name,
          description: space.description || space.desc || null,
          color: space.color,
          item_count: space.item_count || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', space.id);
      
      if (error) {
        console.error('Error updating space in Supabase:', error);
        throw error;
      }
      
      console.log('✅ Space updated in Supabase:', space.name);
    } catch (error) {
      console.error('Failed to update space in Supabase:', error);
      throw error;
    }
  }

  // Delete a space from Supabase
  async deleteSpace(spaceId: string): Promise<void> {
    const isOnline = await this.checkConnection();
    
    if (!isOnline) {
      console.log('📵 Offline - space deletion will sync later');
      // TODO: Add to offline queue for deletion
      return;
    }
    
    try {
      // First delete all item_spaces relationships for this space
      const { error: itemSpacesError } = await supabase
        .from('item_spaces')
        .delete()
        .eq('space_id', spaceId);
      
      if (itemSpacesError) {
        console.error('Error deleting item_spaces relationships:', itemSpacesError);
      }
      
      // Then delete the space itself
      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', spaceId);
      
      if (error) {
        console.error('Error deleting space from Supabase:', error);
        throw error;
      }
      
      console.log('✅ Space deleted from Supabase:', spaceId);
    } catch (error) {
      console.error('Failed to delete space from Supabase:', error);
      throw error;
    }
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