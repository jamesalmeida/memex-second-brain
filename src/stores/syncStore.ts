import { observable } from '@legendapp/state';
import { syncService } from '../services/syncService';

interface SyncState {
  lastSyncTime: string | null;
  pendingItems: number;
  totalSynced: number;
  isOnline: boolean;
  isSyncing: boolean;
  lastError: string | null;
  autoSync: boolean;
}

const initialState: SyncState = {
  lastSyncTime: null,
  pendingItems: 0,
  totalSynced: 0,
  isOnline: true,
  isSyncing: false,
  lastError: null,
  autoSync: true,
};

export const syncStore = observable(initialState);

// Computed values
export const syncComputed = {
  status: () => {
    const state = syncStore.get();
    if (!state.isOnline) return 'offline';
    if (state.isSyncing) return 'syncing';
    if (state.pendingItems > 0) return 'pending';
    return 'synced';
  },
  
  statusColor: () => {
    const status = syncComputed.status();
    switch (status) {
      case 'offline': return '#FF3B30'; // Red
      case 'syncing': return '#FF9500'; // Orange
      case 'pending': return '#FFCC00'; // Yellow
      case 'synced': return '#34C759'; // Green
      default: return '#8E8E93'; // Gray
    }
  },
  
  statusText: () => {
    const state = syncStore.get();
    if (!state.isOnline) return 'Offline';
    if (state.isSyncing) return 'Syncing...';
    if (state.pendingItems > 0) return `${state.pendingItems} pending`;
    if (state.lastSyncTime) {
      const lastSync = new Date(state.lastSyncTime);
      const now = new Date();
      const diffMs = now.getTime() - lastSync.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just synced';
      if (diffMins < 60) return `Synced ${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Synced ${diffHours} hr ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `Synced ${diffDays} days ago`;
    }
    return 'Never synced';
  },
  
  canSync: () => {
    const state = syncStore.get();
    return state.isOnline && !state.isSyncing;
  },
};

// Actions
export const syncActions = {
  updateStatus: (updates: Partial<SyncState>) => {
    const current = syncStore.get();
    syncStore.set({ ...current, ...updates });
  },
  
  setOnline: (isOnline: boolean) => {
    syncStore.isOnline.set(isOnline);
  },
  
  setSyncing: (isSyncing: boolean) => {
    syncStore.isSyncing.set(isSyncing);
  },
  
  setPendingItems: (count: number) => {
    syncStore.pendingItems.set(count);
  },
  
  setLastSyncTime: (time: string | null) => {
    syncStore.lastSyncTime.set(time);
  },
  
  setAutoSync: (enabled: boolean) => {
    syncStore.autoSync.set(enabled);
  },
  
  setLastError: (error: string | null) => {
    syncStore.lastError.set(error);
  },
  
  incrementTotalSynced: (count: number = 1) => {
    const current = syncStore.totalSynced.get();
    syncStore.totalSynced.set(current + count);
  },
  
  // Sync with the service status
  syncWithService: () => {
    const status = syncService.getSyncStatus();
    syncStore.set({
      lastSyncTime: status.lastSyncTime,
      pendingItems: status.pendingItems,
      totalSynced: status.totalSynced,
      isOnline: status.isOnline,
      isSyncing: status.isSyncing,
      lastError: status.lastError,
      autoSync: syncStore.autoSync.get(), // Keep current autoSync setting
    });
  },
  
  // Force a manual sync
  forceSync: async () => {
    if (!syncComputed.canSync()) {
      console.log('Cannot sync: offline or already syncing');
      return;
    }
    
    syncStore.isSyncing.set(true);
    syncStore.lastError.set(null);
    
    try {
      const result = await syncService.syncAll();
      
      if (result.success) {
        syncStore.lastSyncTime.set(result.timestamp);
        syncStore.totalSynced.set(syncStore.totalSynced.get() + result.itemsSynced);
        syncStore.pendingItems.set(0);
      } else {
        syncStore.lastError.set(result.errors.join(', '));
      }
    } catch (error: any) {
      console.error('Force sync failed:', error);
      syncStore.lastError.set(error.message);
    } finally {
      syncStore.isSyncing.set(false);
    }
  },
  
  reset: () => {
    syncStore.set(initialState);
  },
};

// Subscribe to sync service updates
syncService.subscribe((status) => {
  syncActions.syncWithService();
});

// Load initial status
syncService.loadSyncStatus().then(() => {
  syncActions.syncWithService();
});