import { pendingItemsStore, pendingItemsActions } from '../stores/pendingItems';
import { itemsStore } from '../stores/items';
import { authStore } from '../stores/auth';
import { itemProcessingQueue } from './itemProcessingQueue';

/**
 * Service to automatically process pending items from Share Extension
 * when the app starts up
 */

/**
 * Check if an item needs processing based on its metadata completeness
 * More lenient check - having title + (description OR thumbnail) is sufficient
 * to show the card, though enrichment may still run in background
 */
function shouldProcessItem(item: { title?: string; url: string; desc?: string; thumbnail_url?: string }): boolean {
  const hasTitle = item.title && item.title !== item.url && !item.title.startsWith('http');
  const hasDescription = item.desc && item.desc.length > 0;
  const hasThumbnail = item.thumbnail_url && item.thumbnail_url.length > 0;

  // Item is displayable if it has title + either description or thumbnail
  // The card can show while enrichment happens in background
  const isDisplayable = hasTitle && (hasDescription || hasThumbnail);

  if (!isDisplayable) {
    console.log(`🔍 [PendingProcessor] Item needs processing (missing basic metadata)`);
    return true;
  }

  // Item has enough metadata to display - enrichment can happen silently
  console.log(`✅ [PendingProcessor] Item has basic metadata, will enrich silently`);
  return false;
}

/**
 * Main function to process all pending items on app startup
 * This is called from useAuth after realtime sync starts
 * Uses the processing queue to ensure sequential processing
 */
export async function processPendingItemsOnStartup(): Promise<void> {
  try {
    console.log('🚀 [PendingProcessor] Starting automatic processing of pending items...');

    // First, fetch pending items from Supabase (in case app was closed when items were shared)
    await pendingItemsActions.fetchFromSupabase();

    // Get pending items from store (Share Extension items)
    const pendingItems = pendingItemsStore.items.get();

    // Filter for items that are still pending or processing
    const activePendingItems = pendingItems.filter(
      p => p.status === 'pending' || p.status === 'processing'
    );

    if (activePendingItems.length === 0) {
      console.log('ℹ️ [PendingProcessor] No pending items to process');
      return;
    }

    console.log(`📋 [PendingProcessor] Found ${activePendingItems.length} pending items to process`);

    // Get all items from store
    const allItems = itemsStore.items.get();

    // Process each pending item through the queue
    const processingPromises = activePendingItems.map(async (pendingItem) => {
      try {
        // Find the corresponding real item by URL
        const realItem = allItems.find(item => item.url === pendingItem.url);

        if (realItem) {
          // Check if item needs processing
          if (!shouldProcessItem(realItem)) {
            console.log(`⏩ [PendingProcessor] Skipping item (already processed): ${realItem.id}`);
            await pendingItemsActions.updateStatus(pendingItem.id, 'completed');
            return;
          }

          // Enqueue processing for existing item
          console.log(`📥 [PendingProcessor] Enqueuing existing item for processing: ${realItem.id}`);
          const result = await itemProcessingQueue.enqueue({
            url: pendingItem.url,
            itemId: realItem.id,
            spaceId: pendingItem.space_id || null,
            content: pendingItem.content,
            source: 'share_extension',
          });

          if (result.success) {
            await pendingItemsActions.updateStatus(pendingItem.id, 'completed');
            console.log(`✅ [PendingProcessor] Marked pending item as completed: ${pendingItem.id}`);
          } else {
            await pendingItemsActions.updateStatus(pendingItem.id, 'failed', result.error);
            console.error(`❌ [PendingProcessor] Failed to process item: ${pendingItem.id}`);
          }
        } else {
          // Item doesn't exist yet, enqueue creation and processing
          console.log(`📥 [PendingProcessor] Enqueuing new item for creation and processing: ${pendingItem.url}`);
          const result = await itemProcessingQueue.enqueue({
            url: pendingItem.url,
            spaceId: pendingItem.space_id || null,
            content: pendingItem.content,
            source: 'share_extension',
          });

          if (result.success) {
            await pendingItemsActions.updateStatus(pendingItem.id, 'completed');
            console.log(`✅ [PendingProcessor] Marked pending item as completed: ${pendingItem.id}`);
          } else {
            await pendingItemsActions.updateStatus(pendingItem.id, 'failed', result.error);
            console.error(`❌ [PendingProcessor] Failed to process item: ${pendingItem.id}`);
          }
        }
      } catch (error) {
        console.error(`❌ [PendingProcessor] Error processing pending item ${pendingItem.id}:`, error);
        await pendingItemsActions.updateStatus(pendingItem.id, 'failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Wait for all items to be enqueued (they'll process sequentially)
    await Promise.all(processingPromises);

    console.log('✅ [PendingProcessor] Completed enqueuing all pending items');
  } catch (error) {
    console.error('❌ [PendingProcessor] Error in processPendingItemsOnStartup:', error);
    // Don't throw - we don't want to crash the app if pending item processing fails
  }
}

/**
 * Process a single pending item by URL
 * This is called when a new pending item is added via realtime sync
 * Uses the processing queue to ensure sequential processing
 */
export async function processPendingItemByUrl(url: string, pendingItemId: string): Promise<void> {
  try {
    console.log(`🔍 [PendingProcessor] Processing pending item by URL: ${url}`);

    // Get pending item to extract space_id and content
    const pendingItem = pendingItemsStore.items.get().find(p => p.id === pendingItemId);

    // Check if user is authenticated
    const user = authStore.user.get();
    if (!user) {
      console.error(`❌ [PendingProcessor] No authenticated user, cannot process item`);
      await pendingItemsActions.updateStatus(pendingItemId, 'failed', 'No authenticated user');
      return;
    }

    // Find the real item by URL
    const realItem = itemsStore.items.get().find(item => item.url === url);

    if (realItem) {
      // Check if item needs processing
      if (!shouldProcessItem(realItem)) {
        console.log(`⏩ [PendingProcessor] Skipping item (already processed): ${realItem.id}`);
        await pendingItemsActions.updateStatus(pendingItemId, 'completed');
        return;
      }

      // Enqueue processing for existing item
      console.log(`📥 [PendingProcessor] Enqueuing existing item for processing: ${realItem.id}`);
      const result = await itemProcessingQueue.enqueue({
        url,
        itemId: realItem.id,
        spaceId: pendingItem?.space_id || null,
        content: pendingItem?.content,
        source: 'share_extension',
      });

      if (result.success) {
        await pendingItemsActions.updateStatus(pendingItemId, 'completed');
        console.log(`✅ [PendingProcessor] Marked pending item as completed: ${pendingItemId}`);
      } else {
        await pendingItemsActions.updateStatus(pendingItemId, 'failed', result.error);
        console.error(`❌ [PendingProcessor] Failed to process item: ${pendingItemId}`);
      }
    } else {
      // Item doesn't exist yet, enqueue creation and processing
      console.log(`📥 [PendingProcessor] Enqueuing new item for creation and processing: ${url}`);
      const result = await itemProcessingQueue.enqueue({
        url,
        spaceId: pendingItem?.space_id || null,
        content: pendingItem?.content,
        source: 'share_extension',
      });

      if (result.success) {
        await pendingItemsActions.updateStatus(pendingItemId, 'completed');
        console.log(`✅ [PendingProcessor] Marked pending item as completed: ${pendingItemId}`);
      } else {
        await pendingItemsActions.updateStatus(pendingItemId, 'failed', result.error);
        console.error(`❌ [PendingProcessor] Failed to process item: ${pendingItemId}`);
      }
    }
  } catch (error) {
    console.error(`❌ [PendingProcessor] Error in processPendingItemByUrl:`, error);
    await pendingItemsActions.updateStatus(pendingItemId, 'failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const pendingItemsProcessor = {
  processPendingItemsOnStartup,
  processPendingItemByUrl,
};
