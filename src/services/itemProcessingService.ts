import { itemsStore, itemsActions } from '../stores/items';
import { processingItemsActions } from '../stores/processingItems';
import { adminSettingsComputed } from '../stores/adminSettings';
import { authStore } from '../stores/auth';
import { runPipeline } from './pipeline/runPipeline';
import { buildItemContext } from './contextBuilder';
import { openai } from './openai';
import { Item } from '../types';
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
        item = itemsStore.items.get().find(i => i.url === trimmedUrl && i.user_id === userId);
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

    // Add to processing store (shows ProcessingItemCard)
    processingItemsActions.add(itemId);
    console.log(`⏳ [ItemProcessingService] Starting processing for item: ${itemId}`);

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
    // Always remove from processing store when done
    if (itemId) {
      processingItemsActions.remove(itemId);
      console.log(`🧹 [ItemProcessingService] Removed item from processing store: ${itemId}`);
    }
  }
}

