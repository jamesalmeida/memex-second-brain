import { observable } from '@legendapp/state';
import { OfflineQueue, ActionType, QueueStatus } from '../types';

interface OfflineQueueState {
  queue: OfflineQueue[];
  isOnline: boolean;
  isSyncing: boolean;
}

const initialState: OfflineQueueState = {
  queue: [],
  isOnline: true,
  isSyncing: false,
};

export const offlineQueueStore = observable(initialState);

// Computed values
export const offlineQueueComputed = {
  queue: () => offlineQueueStore.queue.get(),
  isOnline: () => offlineQueueStore.isOnline.get(),
  isSyncing: () => offlineQueueStore.isSyncing.get(),
  pendingCount: () => {
    const queue = offlineQueueStore.queue.get();
    return queue.filter(item => item.status === 'pending').length;
  },
  failedCount: () => {
    const queue = offlineQueueStore.queue.get();
    return queue.filter(item => item.status === 'failed').length;
  },
  totalCount: () => offlineQueueStore.queue.get().length,
};

// Actions
export const offlineQueueActions = {
  addToQueue: (item: Omit<OfflineQueue, 'id' | 'created_at' | 'status'>) => {
    const currentQueue = offlineQueueStore.queue.get();

    // Check for duplicates based on action_type and item id
    const isDuplicate = currentQueue.some(queueItem => {
      if (queueItem.action_type === item.action_type && queueItem.status === 'pending') {
        // For create_item and update_item, check if same item id
        if ((item.action_type === 'create_item' || item.action_type === 'update_item') &&
            queueItem.data?.id === item.data?.id) {
          return true;
        }
        // For delete_item, check if same item id
        if (item.action_type === 'delete_item' && queueItem.data?.id === item.data?.id) {
          return true;
        }
        // For item-space operations, check both item_id and space_id
        if ((item.action_type === 'add_item_to_space' || item.action_type === 'remove_item_from_space') &&
            queueItem.data?.item_id === item.data?.item_id &&
            queueItem.data?.space_id === item.data?.space_id) {
          return true;
        }
      }
      return false;
    });

    // Skip adding if duplicate found
    if (isDuplicate) {
      console.log(`⚠️ Skipping duplicate queue item: ${item.action_type} for item ${item.data?.id || 'unknown'}`);
      return;
    }

    const newItem: OfflineQueue = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      status: 'pending',
    };

    offlineQueueStore.queue.set([...currentQueue, newItem]);
  },

  updateQueueItem: (id: string, updates: Partial<OfflineQueue>) => {
    const currentQueue = offlineQueueStore.queue.get();
    const updatedQueue = currentQueue.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    offlineQueueStore.queue.set(updatedQueue);
  },

  removeFromQueue: (id: string) => {
    const currentQueue = offlineQueueStore.queue.get();
    const filteredQueue = currentQueue.filter(item => item.id !== id);
    offlineQueueStore.queue.set(filteredQueue);
  },

  markAsSynced: (id: string) => {
    offlineQueueActions.updateQueueItem(id, { status: 'synced' });
  },

  markAsFailed: (id: string) => {
    offlineQueueActions.updateQueueItem(id, { status: 'failed' });
  },

  retryFailed: () => {
    const currentQueue = offlineQueueStore.queue.get();
    const updatedQueue = currentQueue.map(item =>
      item.status === 'failed' ? { ...item, status: 'pending' as QueueStatus } : item
    );
    offlineQueueStore.queue.set(updatedQueue);
  },

  clearSynced: () => {
    const currentQueue = offlineQueueStore.queue.get();
    const filteredQueue = currentQueue.filter(item => item.status !== 'synced');
    offlineQueueStore.queue.set(filteredQueue);
  },

  setOnline: (online: boolean) => {
    offlineQueueStore.isOnline.set(online);
  },

  setSyncing: (syncing: boolean) => {
    offlineQueueStore.isSyncing.set(syncing);
  },

  // Batch operations
  getPendingItems: (): OfflineQueue[] => {
    const queue = offlineQueueStore.queue.get();
    return queue.filter(item => item.status === 'pending');
  },

  getItemsByType: (actionType: ActionType): OfflineQueue[] => {
    const queue = offlineQueueStore.queue.get();
    return queue.filter(item => item.action_type === actionType && item.status === 'pending');
  },

  reset: () => {
    offlineQueueStore.set(initialState);
  },
};
