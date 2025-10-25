import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Item, SearchFilters, VideoTranscript } from '../types';
import { STORAGE_KEYS } from '../constants';
import { syncOperations } from '../services/syncOperations';
import { authStore } from './auth';
import { itemSpacesComputed, itemSpacesActions } from './itemSpaces';
import { spacesActions } from './spaces';
import { videoTranscriptsActions } from './videoTranscripts';
import { aiSettingsStore } from './aiSettings';
import { imageDescriptionsActions } from './imageDescriptions';
import { itemTypeMetadataComputed } from './itemTypeMetadata';
import { openai } from '../services/openai';
import { getYouTubeTranscript } from '../services/youtube';
import { getXVideoTranscript } from '../services/twitter';
import uuid from 'react-native-uuid';

interface ItemsState {
  items: Item[];
  filteredItems: Item[];
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  searchQuery: string;
  filters: SearchFilters;
  selectedItem: Item | null;
}

const initialState: ItemsState = {
  items: [],
  filteredItems: [],
  isLoading: false,
  hasMore: true,
  offset: 0,
  searchQuery: '',
  filters: {},
  selectedItem: null,
};

export const itemsStore = observable(initialState);

// Computed values
export const itemsComputed = {
  items: () => itemsStore.items.get(),
  filteredItems: () => itemsStore.filteredItems.get(),
  isLoading: () => itemsStore.isLoading.get(),
  hasMore: () => itemsStore.hasMore.get(),
  searchQuery: () => itemsStore.searchQuery.get(),
  filters: () => itemsStore.filters.get(),
  selectedItem: () => itemsStore.selectedItem.get(),
  totalCount: () => itemsStore.items.get().length,
  filteredCount: () => itemsStore.filteredItems.get().length,
};

// Actions
export const itemsActions = {
  setItems: async (items: Item[]) => {
    // Keep tombstones in storage but hide from filtered view
    itemsStore.items.set(items);
    const visible = items.filter(i => !i.is_deleted);
    itemsStore.filteredItems.set(visible);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  },

  // Add item with Supabase sync
  addItemWithSync: async (newItem: Item) => {
    const currentItems = itemsStore.items.get();
    const updatedItems = [newItem, ...currentItems];

    // Save locally first
    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));

      // Sync with Supabase if authenticated
      const user = authStore.user.get();
      if (user) {
        await syncOperations.uploadItem(newItem, user.id);
      }

      // Auto-generate content in background (non-blocking)
      setTimeout(() => {
        itemsActions._autoGenerateContent(newItem).catch(err => {
          console.error('Error auto-generating content:', err);
        });
      }, 100);
    } catch (error) {
      console.error('Error saving item:', error);
    }
  },

  // Auto-generate transcripts and image descriptions if enabled
  _autoGenerateContent: async (item: Item) => {
    const autoGenerateTranscripts = aiSettingsStore.autoGenerateTranscripts.get();
    const autoGenerateImageDescriptions = aiSettingsStore.autoGenerateImageDescriptions.get();
    const selectedModel = aiSettingsStore.selectedModel.get();

    // Auto-generate video transcript if enabled
    if (autoGenerateTranscripts) {
      const isYouTube = item.content_type === 'youtube' || item.content_type === 'youtube_short';
      const isXVideo = item.content_type === 'x' && itemTypeMetadataComputed.getVideoUrl(item.id);

      if (isYouTube || isXVideo) {
        console.log('🎬 Auto-generating transcript for', item.id);
        videoTranscriptsActions.setGenerating(item.id, true);

        try {
          let fetchedTranscript: string;
          let language: string;
          let platform: 'youtube' | 'x';

          if (isYouTube && item.url) {
            // Extract video ID from URL for YouTube
            const videoIdMatch = item.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
            if (!videoIdMatch) {
              throw new Error('Invalid YouTube URL');
            }
            const videoId = videoIdMatch[1];

            // Fetch transcript from YouTube
            const result = await getYouTubeTranscript(videoId);
            fetchedTranscript = result.transcript;
            language = result.language;
            platform = 'youtube';
          } else if (isXVideo) {
            // Get video URL from metadata for X posts
            const videoUrl = itemTypeMetadataComputed.getVideoUrl(item.id);
            if (!videoUrl) {
              throw new Error('No video found for this X post');
            }

            // Fetch transcript from AssemblyAI
            const result = await getXVideoTranscript(videoUrl, (status) => {
              console.log('Transcription status:', status);
            });
            fetchedTranscript = result.transcript;
            language = result.language;
            platform = 'x';
          } else {
            throw new Error('Unsupported content type for transcription');
          }

          // Create video transcript object
          const transcriptData: VideoTranscript = {
            id: uuid.v4() as string,
            item_id: item.id,
            transcript: fetchedTranscript,
            platform,
            language,
            duration: item.duration,
            fetched_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Save to local store and sync to Supabase
          await videoTranscriptsActions.addTranscript(transcriptData);
          console.log('🎬 Auto-generated transcript saved for item:', item.id);
        } catch (error) {
          console.error('Error auto-generating transcript:', error);
        } finally {
          videoTranscriptsActions.setGenerating(item.id, false);
        }
      }
    }

    // Auto-generate image descriptions if enabled
    if (autoGenerateImageDescriptions) {
      const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);
      if (imageUrls && imageUrls.length > 0) {
        console.log('🖼️  Auto-generating descriptions for', imageUrls.length, 'images');
        imageDescriptionsActions.setGenerating(item.id, true);
        try {
          for (const imageUrl of imageUrls) {
            const description = await openai.describeImage(imageUrl, {
              model: selectedModel.includes('gpt-4') ? selectedModel : 'gpt-4o-mini',
            });

            if (description) {
              const imageDescription = {
                id: `${item.id}-${imageUrl}`,
                item_id: item.id,
                image_url: imageUrl,
                description,
                model: selectedModel.includes('gpt-4') ? selectedModel : 'gpt-4o-mini',
                fetched_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              await imageDescriptionsActions.addDescription(imageDescription);
            }
          }
        } catch (error) {
          console.error('Error generating image descriptions:', error);
        } finally {
          imageDescriptionsActions.setGenerating(item.id, false);
        }
      }
    }
  },

  addItems: async (newItems: Item[]) => {
    const currentItems = itemsStore.items.get();
    const updatedItems = [...currentItems, ...newItems];
    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  },

  updateItem: async (id: string, updates: Partial<Item>) => {
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  },

  // Update item with Supabase sync
  updateItemWithSync: async (id: string, updates: Partial<Item>) => {
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );
    
    // Update locally first
    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
      
      // Sync with Supabase using offline-aware service (dynamic import to avoid require cycle)
      const { syncService } = await import('../services/syncService');
      await syncService.updateItem(id, updates);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  },

  removeItem: async (id: string) => {
    const currentItems = itemsStore.items.get();
    const filteredItems = currentItems.filter(item => item.id !== id);
    itemsStore.items.set(filteredItems);
    itemsStore.filteredItems.set(filteredItems);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(filteredItems));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  },

  // Remove item with Supabase sync (Soft delete / Trash)
  removeItemWithSync: async (id: string) => {
    console.log(`🗑️ [itemsActions] Starting removeItemWithSync (soft delete) for item ${id}`);

    const nowIso = new Date().toISOString();

    // Mark item as deleted locally (keep as tombstone for sync)
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.id === id ? { ...item, is_deleted: true, deleted_at: nowIso, updated_at: nowIso } : item
    );

    // Keep ALL items including deleted (tombstones) but filter for UI
    const visibleItems = updatedItems.filter(item => !item.is_deleted);

    itemsStore.items.set(updatedItems); // Store ALL items including tombstones
    itemsStore.filteredItems.set(visibleItems); // Filter for UI only
    console.log(`🗑️ [itemsActions] Soft-deleted item ${id} locally. ${visibleItems.length} visible items, ${updatedItems.length} total (including tombstones).`);

    try {
      // Save ALL items including tombstones to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
      console.log(`🗑️ [itemsActions] Updated AsyncStorage with tombstone for item ${id}`);

      // Sync soft delete to Supabase
      await syncOperations.deleteItem(id);
      console.log(`🗑️ [itemsActions] Completed soft delete sync for item ${id}`);
    } catch (error) {
      console.error(`🗑️ [itemsActions] Error soft-deleting item ${id}:`, error);
      throw error;
    }
  },

  // Archive item with Supabase sync
  archiveItemWithSync: async (id: string, autoArchived: boolean = false) => {
    console.log(`📦 [itemsActions] Archiving item ${id} (auto: ${autoArchived})`);

    const nowIso = new Date().toISOString();
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.id === id ? {
        ...item,
        is_archived: true,
        archived_at: nowIso,
        auto_archived: autoArchived,
        updated_at: nowIso
      } : item
    );

    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));

      const { syncService } = await import('../services/syncService');
      await syncService.updateItem(id, { is_archived: true, archived_at: nowIso, auto_archived: autoArchived });
      console.log(`✅ [itemsActions] Archived item ${id}`);
    } catch (error) {
      console.error(`❌ [itemsActions] Error archiving item ${id}:`, error);
      throw error;
    }
  },

  // Unarchive item with Supabase sync
  unarchiveItemWithSync: async (id: string) => {
    console.log(`📂 [itemsActions] Unarchiving item ${id}`);

    const nowIso = new Date().toISOString();
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.id === id ? {
        ...item,
        is_archived: false,
        archived_at: null,
        auto_archived: false,
        updated_at: nowIso
      } : item
    );

    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));

      const { syncService } = await import('../services/syncService');
      await syncService.updateItem(id, { is_archived: false, archived_at: null, auto_archived: false });
      console.log(`✅ [itemsActions] Unarchived item ${id}`);
    } catch (error) {
      console.error(`❌ [itemsActions] Error unarchiving item ${id}:`, error);
      throw error;
    }
  },

  // Bulk archive items in a space (used when archiving a space)
  bulkArchiveItemsInSpace: async (spaceId: string) => {
    console.log(`📦 [itemsActions] Bulk archiving items in space ${spaceId}`);

    const nowIso = new Date().toISOString();
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.space_id === spaceId && !item.is_archived ? {
        ...item,
        is_archived: true,
        archived_at: nowIso,
        auto_archived: true, // Mark as auto-archived for restoration
        updated_at: nowIso
      } : item
    );

    const archivedCount = updatedItems.filter(i => i.space_id === spaceId && i.is_archived).length -
                         currentItems.filter(i => i.space_id === spaceId && i.is_archived).length;

    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
      console.log(`✅ [itemsActions] Bulk archived ${archivedCount} items in space ${spaceId}`);
      return archivedCount;
    } catch (error) {
      console.error(`❌ [itemsActions] Error bulk archiving items:`, error);
      throw error;
    }
  },

  // Bulk unarchive auto-archived items in a space (used when unarchiving a space)
  bulkUnarchiveAutoArchivedItemsInSpace: async (spaceId: string) => {
    console.log(`📂 [itemsActions] Bulk unarchiving auto-archived items in space ${spaceId}`);

    const nowIso = new Date().toISOString();
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.space_id === spaceId && item.is_archived && item.auto_archived ? {
        ...item,
        is_archived: false,
        archived_at: null,
        auto_archived: false,
        updated_at: nowIso
      } : item
    );

    const unarchivedCount = currentItems.filter(i => i.space_id === spaceId && i.is_archived && i.auto_archived).length;

    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
      console.log(`✅ [itemsActions] Bulk unarchived ${unarchivedCount} auto-archived items in space ${spaceId}`);
      return unarchivedCount;
    } catch (error) {
      console.error(`❌ [itemsActions] Error bulk unarchiving items:`, error);
      throw error;
    }
  },

  setLoading: (loading: boolean) => {
    itemsStore.isLoading.set(loading);
  },

  setHasMore: (hasMore: boolean) => {
    itemsStore.hasMore.set(hasMore);
  },

  setOffset: (offset: number) => {
    itemsStore.offset.set(offset);
  },

  setSearchQuery: (query: string) => {
    itemsStore.searchQuery.set(query);
  },

  setFilters: (filters: SearchFilters) => {
    itemsStore.filters.set(filters);
  },

  setSelectedItem: (item: Item | null) => {
    itemsStore.selectedItem.set(item);
  },

  // Advanced filtering and search
  applyFilters: () => {
    const items = itemsStore.items.get();
    const filters = itemsStore.filters.get();
    const searchQuery = itemsStore.searchQuery.get();

    let filtered = items;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.desc?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.raw_text?.toLowerCase().includes(query) ||
        item.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply content type filter
    if (filters.contentType) {
      filtered = filtered.filter(item => item.content_type === filters.contentType);
    }

    // Apply archived filter
    if (filters.isArchived !== undefined) {
      filtered = filtered.filter(item => item.is_archived === filters.isArchived);
    }

    itemsStore.filteredItems.set(filtered);
  },

  reset: () => {
    itemsStore.set(initialState);
  },

  clearAll: () => {
    // Clear items and filtered items
    itemsStore.items.set([]);
    itemsStore.filteredItems.set([]);
    itemsStore.filters.set({});
    itemsStore.searchQuery.set('');
    console.log('📦 Cleared all items from store');
  },

  clearFilters: () => {
    itemsStore.filters.set({});
    itemsStore.searchQuery.set('');
    itemsStore.filteredItems.set(itemsStore.items.get());
  },

  // Clear mock items from storage
  clearMockItems: async () => {
    const currentItems = itemsStore.items.get();
    const realItems = currentItems.filter(item => !item.isMockData);
    
    itemsStore.items.set(realItems);
    itemsStore.filteredItems.set(realItems);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(realItems));
      console.log('✅ Cleared mock items, kept', realItems.length, 'real items');
    } catch (error) {
      console.error('Error clearing mock items:', error);
    }
  },

  loadItems: async () => {
    try {
      const savedItems = await AsyncStorage.getItem(STORAGE_KEYS.ITEMS);
      if (savedItems) {
        const items = JSON.parse(savedItems) as Item[];
        const visibleItems = items.filter(item => !item.is_deleted);
        itemsStore.items.set(items); // Load ALL items including tombstones
        itemsStore.filteredItems.set(visibleItems); // Filter deleted for UI
        console.log('📚 Loaded', items.length, 'items from storage (', visibleItems.length, 'visible,', items.length - visibleItems.length, 'deleted)');
      }
    } catch (error) {
      console.error('Error loading items from storage:', error);
    }
  },

  // Refresh metadata for an item - re-extract from URL based on current content type
  refreshMetadata: async (itemId: string): Promise<boolean> => {
    const currentItems = itemsStore.items.get();
    const item = currentItems.find(i => i.id === itemId);

    if (!item || !item.url) {
      console.error('Cannot refresh metadata: item not found or has no URL');
      return false;
    }

    try {
      // Import extractURLMetadata dynamically to avoid circular dependencies
      const { extractURLMetadata } = await import('../services/urlMetadata');
      const { itemTypeMetadataActions } = await import('./itemTypeMetadata');
      const { itemMetadataActions } = await import('./itemMetadata');

      console.log(`Refreshing metadata for item ${itemId} as content type: ${item.content_type}`);

      // Re-extract metadata using the current URL
      const metadata = await extractURLMetadata(item.url);

      // Update item with new metadata
      const updates: Partial<Item> = {
        title: metadata.title || item.title,
        desc: metadata.description || item.desc,
        thumbnail_url: metadata.image || item.thumbnail_url,
        updated_at: new Date().toISOString(),
      };

      // Update the item in store and database
      await itemsActions.updateItemWithSync(itemId, updates);

      // Update type-specific metadata if available
      if (metadata.videoUrl || metadata.images || metadata.redditMetadata || metadata.favicon) {
        await itemTypeMetadataActions.upsertTypeMetadata({
          item_id: itemId,
          content_type: item.content_type,
          data: {
            video_url: metadata.videoUrl,
            image_urls: metadata.images,
            reddit_metadata: metadata.redditMetadata,
            site_icon_url: metadata.favicon,
          },
        });
      }

      // Update general metadata if available
      if (metadata.author || metadata.siteName) {
        await itemMetadataActions.upsertMetadata({
          item_id: itemId,
          author: metadata.author,
          domain: metadata.siteName,
        });
      }

      console.log('✅ Metadata refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing metadata:', error);
      return false;
    }
  },

  // Update item's thumbnail image
  updateItemImage: async (itemId: string, imageUrl: string, storagePath?: string) => {
    const updates: Partial<Item> = {
      thumbnail_url: imageUrl,
      updated_at: new Date().toISOString(),
    };

    // If this is a user-uploaded image, we could store the storage path in metadata
    // For now, we'll just update the thumbnail_url
    await itemsActions.updateItemWithSync(itemId, updates);

    console.log('✅ Updated item image:', { itemId, imageUrl });
  },

  // Remove item's thumbnail image
  removeItemImage: async (itemId: string) => {
    const updates: Partial<Item> = {
      thumbnail_url: null,
      updated_at: new Date().toISOString(),
    };

    await itemsActions.updateItemWithSync(itemId, updates);

    console.log('✅ Removed item image:', itemId);
  },

  // Note: Full sync is handled by syncService
  // Individual operations use syncOperations directly
};

// Load items on app start
itemsActions.loadItems();
