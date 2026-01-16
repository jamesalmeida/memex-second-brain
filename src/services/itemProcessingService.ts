import AsyncStorage from '@react-native-async-storage/async-storage';
import { itemsStore, itemsActions } from '../stores/items';
import { processingItemsActions } from '../stores/processingItems';
import { adminSettingsComputed } from '../stores/adminSettings';
import { authStore } from '../stores/auth';
import { runPipeline } from './pipeline/runPipeline';
import { buildItemContext } from './contextBuilder';
import { openai } from './openai';
import { Item } from '../types';
import { STORAGE_KEYS } from '../constants';
import { supabase } from './supabase';
import uuid from 'react-native-uuid';

export interface ProcessItemParams {
  url: string;
  itemId?: string; // If provided, use existing item; otherwise create new one
  spaceId?: string | null;
  content?: string; // For notes
  source?: 'share_extension' | 'manual'; // Track where item came from
}

export interface ProcessItemResult {
  itemId: string;
  success: boolean;
  error?: string;
  created: boolean; // Whether a new item was created
}

const SHARE_EXTENSION_REMOTE_CHECKS = 3;
const SHARE_EXTENSION_MAX_WAIT_MS = 12000; // Wait up to 12s for Edge Function to create item
const SHARE_EXTENSION_POLL_INTERVAL_MS = 500; // Check every 500ms

/**
 * Check if an item has sufficient metadata to display without "Processing" card
 * If true, we can show the actual card and run enrichment silently in background
 */
function hasBasicMetadata(item: Item): boolean {
  const hasTitle = item.title && item.title !== item.url && !item.title.startsWith('http');
  const hasDescription = item.desc && item.desc.length > 0;
  const hasThumbnail = item.thumbnail_url && item.thumbnail_url.length > 0;

  // For share extension items, having title + (description OR thumbnail) is enough
  // to show the card immediately while enriching in background
  return hasTitle && (hasDescription || hasThumbnail);
}

function findItemInStoreByUrl(url: string, userId: string): Item | undefined {
  return itemsStore.items.get().find(i => i.url === url && i.user_id === userId && !i.is_deleted);
}

function normalizeRemoteItem(remoteItem: any): Item {
  return {
    ...remoteItem,
    desc: remoteItem.desc ?? remoteItem.description ?? null,
    tags: remoteItem.tags ?? [],
    is_deleted: remoteItem.is_deleted ?? false,
  };
}

async function ensureItemCachedLocally(item: Item) {
  const currentItems = itemsStore.items.get();
  if (currentItems.some(existing => existing.id === item.id)) {
    return;
  }

  const updatedItems = [item, ...currentItems];
  itemsStore.items.set(updatedItems);
  itemsStore.filteredItems.set(updatedItems.filter(i => !i.is_deleted));
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
  } catch (error) {
    console.error('❌ [ItemProcessingService] Failed to cache remotely created item locally:', error);
  }
}

async function fetchExistingItemFromSupabase(url: string, userId: string): Promise<Item | null> {
  const normalizedUrl = url.trim();

  for (let attempt = 0; attempt < SHARE_EXTENSION_REMOTE_CHECKS; attempt++) {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('url', normalizedUrl)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error(`❌ [ItemProcessingService] Supabase lookup failed (attempt ${attempt + 1}):`, error);
      return null;
    }

    if (data && data.length > 0) {
      return normalizeRemoteItem(data[0]);
    }

    if (attempt < SHARE_EXTENSION_REMOTE_CHECKS - 1) {
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }

  return null;
}

async function waitForShareExtensionItem(url: string, userId: string): Promise<Item | null> {
  const normalizedUrl = url.trim();
  const start = Date.now();

  while (Date.now() - start < SHARE_EXTENSION_MAX_WAIT_MS) {
    const localMatch = findItemInStoreByUrl(normalizedUrl, userId);
    if (localMatch) {
      return localMatch;
    }

    const remoteItem = await fetchExistingItemFromSupabase(normalizedUrl, userId);
    if (remoteItem) {
      await ensureItemCachedLocally(remoteItem);
      return remoteItem;
    }

    await new Promise(resolve => setTimeout(resolve, SHARE_EXTENSION_POLL_INTERVAL_MS));
  }

  return null;
}

/**
 * Unified service for processing items (enrichment pipeline + TLDR generation)
 * Used by both Share Extension and AddItemSheet flows
 */
export async function processItem(params: ProcessItemParams): Promise<ProcessItemResult> {
  const { url, itemId: providedItemId, spaceId, content, source = 'manual' } = params;

  if (!url || !url.trim()) {
    return {
      itemId: providedItemId || '',
      success: false,
      error: 'URL is required',
      created: false,
    };
  }

  const userId = authStore.user.get()?.id;
  if (!userId) {
    return {
      itemId: providedItemId || '',
      success: false,
      error: 'User not authenticated',
      created: false,
    };
  }

  let itemId = providedItemId;
  let created = false;

  try {
    // Find or create the item
    let item: Item | undefined;
    const trimmedUrl = url.trim();
    
    if (itemId) {
      // Use existing item by ID
      item = itemsStore.items.get().find(i => i.id === itemId);
      if (!item) {
        console.error(`❌ [ItemProcessingService] Item ${itemId} not found`);
        return {
          itemId,
          success: false,
          error: 'Item not found',
          created: false,
        };
      }
    } else {
      // Check if item already exists by URL (Edge Function may have created it)
      // Wait a bit for realtime sync to update the store, checking multiple times
      let itemFound = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        item = findItemInStoreByUrl(trimmedUrl, userId);
        if (item) {
          itemFound = true;
          break;
        }
        // Wait progressively longer: 50ms, 100ms, 150ms, 200ms, 250ms
        if (attempt < 4) {
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
      
      if (itemFound && item) {
        // Item already exists, use it
        itemId = item.id;
        created = false;
        console.log(`✅ [ItemProcessingService] Found existing item by URL: ${itemId} (source: ${source})`);
      } else {
        let remoteItem: Item | null = null;

        if (source === 'share_extension') {
          remoteItem = await waitForShareExtensionItem(trimmedUrl, userId);
          if (remoteItem) {
            item = remoteItem;
            itemId = remoteItem.id;
            created = false;
            console.log(`✅ [ItemProcessingService] Matched Share Extension item from Supabase: ${itemId}`);
          }
        }

        if (!itemId) {
          // Final check: query Supabase one more time to prevent race conditions
          // The Edge Function might have created the item while we were waiting
          const finalCheck = await fetchExistingItemFromSupabase(trimmedUrl, userId);
          if (finalCheck) {
            item = finalCheck;
            itemId = finalCheck.id;
            created = false;
            console.log(`✅ [ItemProcessingService] Found item on final check (race condition prevented): ${itemId}`);
          } else {
            // Create new item
            itemId = uuid.v4() as string;
            created = true;

            let provisionalTitle = trimmedUrl;
            try {
              provisionalTitle = new URL(trimmedUrl).hostname.replace('www.', '');
            } catch {
              // Invalid URL, use as-is
            }

            const now = new Date().toISOString();
            item = {
              id: itemId,
              user_id: userId,
              title: provisionalTitle,
              url: trimmedUrl,
              desc: content || '',
              thumbnail_url: '',
              content_type: 'bookmark',
              domain: new URL(trimmedUrl).hostname,
              created_at: now,
              updated_at: now,
              is_archived: false,
              is_favorite: false,
              space_id: spaceId || null,
            };

            console.log(`✨ [ItemProcessingService] Creating new item: ${itemId} (source: ${source})`);

            // Add to store and sync to database
            await itemsActions.addItemWithSync(item);
            console.log(`✅ [ItemProcessingService] Created item: ${itemId}`);
          }
        }
      }
    }

    // Always add to processing store - this tracks enrichment state
    // ItemCard will decide whether to show ProcessingItemCard or actual card based on metadata
    // Expanded views use this state to show processing overlays on enrichment-dependent sections
    processingItemsActions.add(itemId);

    const itemHasMetadata = item && hasBasicMetadata(item);
    if (itemHasMetadata) {
      console.log(`🚀 [ItemProcessingService] Item has metadata, card will show while enriching in background: ${itemId}`);
    } else {
      console.log(`⏳ [ItemProcessingService] Item lacks metadata, will show Processing card: ${itemId}`);
    }

    // Get admin preferences for pipeline
    const youtubeSource = adminSettingsComputed.youtubeSource();
    const youtubeTranscriptSource = adminSettingsComputed.youtubeTranscriptSource();

    console.log(`🔧 [ItemProcessingService] YouTube source: ${youtubeSource}, transcript source: ${youtubeTranscriptSource}`);

    // Run the enrichment pipeline
    await runPipeline({
      itemId,
      url: url.trim(),
      preferences: {
        youtubeSource,
        youtubeTranscriptSource,
      },
    });

    console.log(`✅ [ItemProcessingService] Pipeline complete for item: ${itemId}`);

    // Check if we should auto-generate TLDR (after pipeline completes)
    const autoGenerateTldr = adminSettingsComputed.autoGenerateTldr();
    console.log(`🤖 [ItemProcessingService] Auto-generate TLDR enabled: ${autoGenerateTldr}`);

    if (autoGenerateTldr) {
      try {
        // Get the updated item after pipeline enrichment
        const updatedItem = itemsStore.items.get().find(i => i.id === itemId);

        if (updatedItem && !updatedItem.tldr) {
          console.log(`📝 [ItemProcessingService] Generating TLDR for item: ${itemId}`);

          // Build context from the enriched item
          const contextResult = buildItemContext(updatedItem);

          // Generate TLDR using OpenAI
          const generatedTldr = await openai.summarizeContent(
            contextResult.contextString,
            contextResult.metadata.contentType
          );

          // Save TLDR if generated successfully
          if (generatedTldr && generatedTldr !== 'Summary not available') {
            await itemsActions.updateItemWithSync(itemId, { tldr: generatedTldr });
            console.log(`✅ [ItemProcessingService] TLDR generated for item: ${itemId}`);
          } else {
            console.log(`⚠️ [ItemProcessingService] TLDR generation returned no content`);
          }
        } else if (updatedItem?.tldr) {
          console.log(`ℹ️ [ItemProcessingService] Item already has TLDR, skipping generation`);
        }
      } catch (error) {
        console.error(`❌ [ItemProcessingService] Error auto-generating TLDR:`, error);
        // Don't throw - continue with removal
      }
    }

    return {
      itemId,
      success: true,
      created,
    };
  } catch (error) {
    console.error(`❌ [ItemProcessingService] Error processing item:`, error);
    return {
      itemId: itemId || '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      created,
    };
  } finally {
    // Only remove from processing store if we added it
    // (i.e., the item didn't have basic metadata)
    if (itemId) {
      // Always try to remove - it's a no-op if not present
      processingItemsActions.remove(itemId);
    }
  }
}
