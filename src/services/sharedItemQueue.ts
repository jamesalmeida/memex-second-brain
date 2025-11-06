import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { Item } from '../types';

/**
 * Shared item queue using MMKV with iOS App Group support
 *
 * This allows the share extension to save items that the main app can pick up.
 * MMKV supports App Groups natively and provides better performance than FileSystem.
 */

const APP_GROUP_ID = 'group.com.jamesalmeida.memex';
const QUEUE_KEY = 'shared-items-queue';

// Lazy-initialized MMKV instance with app group support
// This will be shared between the main app and share extension
let sharedStorage: MMKV | null = null;
let initializationAttempted = false;

/**
 * Lazy-initialize MMKV with app group support
 * This must be called lazily because MMKV requires JSI which may not be available
 * at module load time (e.g., in Metro bundler or share extension environments)
 */
const getSharedStorage = (): MMKV | null => {
  if (initializationAttempted) {
    return sharedStorage;
  }

  initializationAttempted = true;

  if (Platform.OS !== 'ios') {
    console.warn('[SharedItemQueue] MMKV app groups only supported on iOS');
    return null;
  }

  try {
    sharedStorage = new MMKV({
      id: APP_GROUP_ID,
      // @ts-ignore - appGroupId exists but TypeScript may not recognize it
      appGroupId: APP_GROUP_ID,
    });
    console.log('[SharedItemQueue] ✅ MMKV initialized with app group');
    return sharedStorage;
  } catch (error) {
    console.error('[SharedItemQueue] ❌ Failed to initialize MMKV with app group:', error);
    console.error('[SharedItemQueue] This may happen if JSI is not available (Metro bundler, remote debugger, etc.)');
    return null;
  }
};

/**
 * Add an item to the shared queue
 * Called by the share extension when saving items
 */
export const addItemToSharedQueue = async (item: Item): Promise<void> => {
  const storage = getSharedStorage();
  if (!storage) {
    console.warn('[SharedItemQueue] MMKV not available');
    return;
  }

  try {
    // Read existing queue
    const queueData = storage.getString(QUEUE_KEY);
    const queue: Item[] = queueData ? JSON.parse(queueData) : [];

    // Add new item
    queue.push(item);

    // Write back to MMKV
    storage.set(QUEUE_KEY, JSON.stringify(queue));
    console.log(`[SharedItemQueue] ✅ Added item to queue: ${item.id}`);
  } catch (error) {
    console.error('[SharedItemQueue] ❌ Error adding item to queue:', error);
  }
};

/**
 * Get all items from the shared queue
 * Called by the main app on launch
 */
export const getItemsFromSharedQueue = async (): Promise<Item[]> => {
  const storage = getSharedStorage();
  if (!storage) {
    return [];
  }

  try {
    const queueData = storage.getString(QUEUE_KEY);
    const queue: Item[] = queueData ? JSON.parse(queueData) : [];
    console.log(`[SharedItemQueue] ✅ Read ${queue.length} items from queue`);
    return queue;
  } catch (error) {
    console.error('[SharedItemQueue] ❌ Error reading queue:', error);
    return [];
  }
};

/**
 * Clear the shared queue
 * Called by the main app after importing items
 */
export const clearSharedQueue = async (): Promise<void> => {
  const storage = getSharedStorage();
  if (!storage) {
    return;
  }

  try {
    storage.delete(QUEUE_KEY);
    console.log('[SharedItemQueue] ✅ Cleared queue');
  } catch (error) {
    console.error('[SharedItemQueue] ❌ Error clearing queue:', error);
  }
};
