import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import { syncService } from '../services/syncService';

interface SyncStatusState {
  lastSyncTime: string | null;
  pendingChanges: number;
  totalSynced: number;
  isOnline: boolean;
  isSyncing: boolean;
  lastError: string | null;
}

const initialState: SyncStatusState = {
  lastSyncTime: null,
  pendingChanges: 0,
  totalSynced: 0,
  isOnline: true,
  isSyncing: false,
  lastError: null,
};

export const syncStatusStore = observable(initialState);

// Load sync status from storage on initialization
const loadSyncStatus = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
    if (stored) {
      const status = JSON.parse(stored);
      syncStatusStore.set(status);
      console.log('📊 Loaded sync status from storage');
    }
  } catch (error) {
    console.error('Failed to load sync status:', error);
  }
};

// Save sync status to storage whenever it changes
syncStatusStore.onChange(() => {
  const status = syncStatusStore.get();
  AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(status)).catch(error => {
    console.error('Failed to save sync status:', error);
  });
});

// Subscribe to sync service updates
syncService.addListener((status) => {
  syncStatusStore.set({
    lastSyncTime: status.lastSyncTime,
    pendingChanges: status.pendingItems,
    totalSynced: status.totalSynced,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    lastError: status.lastError,
  });
});

// Load sync status on initialization
loadSyncStatus();
syncService.loadSyncStatus();

// Computed values
export const syncStatusComputed = {
  lastSyncTime: () => syncStatusStore.lastSyncTime.get(),
  pendingChanges: () => syncStatusStore.pendingChanges.get(),
  totalSynced: () => syncStatusStore.totalSynced.get(),
  isOnline: () => syncStatusStore.isOnline.get(),
  isSyncing: () => syncStatusStore.isSyncing.get(),
  lastError: () => syncStatusStore.lastError.get(),
  
  // Format last sync time for display
  formattedLastSync: () => {
    const lastSync = syncStatusStore.lastSyncTime.get();
    if (!lastSync) return 'Never synced';
    
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString();
  },
  
  // Get sync status text
  statusText: () => {
    if (syncStatusStore.isSyncing.get()) return 'Syncing...';
    if (!syncStatusStore.isOnline.get()) return 'Offline';
    if (syncStatusStore.pendingChanges.get() > 0) {
      return `${syncStatusStore.pendingChanges.get()} pending changes`;
    }
    return 'All synced';
  },
  
  // Get status color
  statusColor: () => {
    if (!syncStatusStore.isOnline.get()) return '#FF3B30'; // Red for offline
    if (syncStatusStore.isSyncing.get()) return '#007AFF'; // Blue for syncing
    if (syncStatusStore.pendingChanges.get() > 0) return '#FF9500'; // Orange for pending
    return '#34C759'; // Green for synced
  },
};

// Actions
export const syncStatusActions = {
  updateStatus: (updates: Partial<SyncStatusState>) => {
    const current = syncStatusStore.get();
    syncStatusStore.set({ ...current, ...updates });
  },
  
  reset: () => {
    syncStatusStore.set(initialState);
  },
};