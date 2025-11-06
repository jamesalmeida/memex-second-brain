import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Item } from '../types';

/**
 * Shared item queue using iOS App Group container
 *
 * This allows the share extension to save items that the main app can pick up.
 * Since AsyncStorage is sandboxed per target, we use the shared file system instead.
 */

const APP_GROUP_ID = 'group.com.jamesalmeida.memex';
const QUEUE_FILE_NAME = 'shared-items-queue.json';

// Get the shared container directory path
const getSharedContainerPath = (): string | null => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  // For iOS, the app group container is accessible via a specific path
  // Format: group.{bundle-id} maps to a shared directory
  // We'll use FileSystem.documentDirectory as fallback and rely on the app group
  // being properly configured in native code
  return `${FileSystem.documentDirectory}../../Shared/AppGroup/${APP_GROUP_ID}`;
};

const getQueueFilePath = (): string | null => {
  const containerPath = getSharedContainerPath();
  if (!containerPath) {
    console.warn('[SharedItemQueue] App Groups only supported on iOS');
    return null;
  }
  return `${containerPath}/${QUEUE_FILE_NAME}`;
};

/**
 * Add an item to the shared queue
 * Called by the share extension when saving items
 */
export const addItemToSharedQueue = async (item: Item): Promise<void> => {
  try {
    const queuePath = getQueueFilePath();
    if (!queuePath) {
      console.error('[SharedItemQueue] Cannot access shared container');
      return;
    }

    // Ensure directory exists
    const dirPath = queuePath.substring(0, queuePath.lastIndexOf('/'));
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    // Read existing queue
    let queue: Item[] = [];
    const fileInfo = await FileSystem.getInfoAsync(queuePath);
    if (fileInfo.exists) {
      const content = await FileSystem.readAsStringAsync(queuePath);
      queue = JSON.parse(content);
    }

    // Add new item
    queue.push(item);

    // Write back to file
    await FileSystem.writeAsStringAsync(queuePath, JSON.stringify(queue, null, 2));
    console.log(`[SharedItemQueue] Added item to queue:`, item.id);
  } catch (error) {
    console.error('[SharedItemQueue] Error adding item to queue:', error);
  }
};

/**
 * Get all items from the shared queue
 * Called by the main app on launch
 */
export const getItemsFromSharedQueue = async (): Promise<Item[]> => {
  try {
    const queuePath = getQueueFilePath();
    if (!queuePath) {
      return [];
    }

    const fileInfo = await FileSystem.getInfoAsync(queuePath);
    if (!fileInfo.exists) {
      return [];
    }

    const content = await FileSystem.readAsStringAsync(queuePath);
    const queue: Item[] = JSON.parse(content);
    console.log(`[SharedItemQueue] Read ${queue.length} items from queue`);
    return queue;
  } catch (error) {
    console.error('[SharedItemQueue] Error reading queue:', error);
    return [];
  }
};

/**
 * Clear the shared queue
 * Called by the main app after importing items
 */
export const clearSharedQueue = async (): Promise<void> => {
  try {
    const queuePath = getQueueFilePath();
    if (!queuePath) {
      return;
    }

    const fileInfo = await FileSystem.getInfoAsync(queuePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(queuePath);
      console.log('[SharedItemQueue] Cleared queue');
    }
  } catch (error) {
    console.error('[SharedItemQueue] Error clearing queue:', error);
  }
};
