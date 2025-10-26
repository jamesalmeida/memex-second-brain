import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Space } from '../types';
import { STORAGE_KEYS } from '../constants';
import { syncOperations } from '../services/syncOperations';
import { authStore } from './auth';

interface SpacesState {
  spaces: Space[];
  isLoading: boolean;
  selectedSpace: Space | null;
}

const initialState: SpacesState = {
  spaces: [],
  isLoading: false,
  selectedSpace: null,
};

export const spacesStore = observable(initialState);

// Load spaces from storage on initialization
const loadSpaces = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SPACES);
    if (stored) {
      const spaces = JSON.parse(stored);
      spacesStore.spaces.set(spaces || []);
      console.log('📚 Loaded', spaces?.length || 0, 'spaces from storage');
    }
  } catch (error) {
    console.error('Failed to load spaces:', error);
  }
};

// Save spaces to storage whenever they change
spacesStore.spaces.onChange(() => {
  const spaces = spacesStore.spaces.get();
  AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(spaces)).catch(error => {
    console.error('Failed to save spaces:', error);
  });
});

// Load spaces on initialization
loadSpaces();

// Computed values
export const spacesComputed = {
  spaces: () => {
    const spaces = spacesStore.spaces.get();
    // Filter out deleted spaces and sort by order_index (ascending)
    const activeSpaces = spaces.filter(space => !space.is_deleted);
    return [...activeSpaces].sort((a, b) => {
      if (a.order_index === undefined && b.order_index === undefined) return 0;
      if (a.order_index === undefined) return 1;
      if (b.order_index === undefined) return -1;
      return a.order_index - b.order_index;
    });
  },
  activeSpaces: () => {
    const spaces = spacesStore.spaces.get();
    // Filter out deleted AND archived spaces
    const activeSpaces = spaces.filter(space => !space.is_deleted && !space.is_archived);
    return [...activeSpaces].sort((a, b) => {
      if (a.order_index === undefined && b.order_index === undefined) return 0;
      if (a.order_index === undefined) return 1;
      if (b.order_index === undefined) return -1;
      return a.order_index - b.order_index;
    });
  },
  archivedSpaces: () => {
    const spaces = spacesStore.spaces.get();
    // Get archived spaces (not deleted)
    const archivedSpaces = spaces.filter(space => !space.is_deleted && space.is_archived);
    return [...archivedSpaces].sort((a, b) => {
      if (a.order_index === undefined && b.order_index === undefined) return 0;
      if (a.order_index === undefined) return 1;
      if (b.order_index === undefined) return -1;
      return a.order_index - b.order_index;
    });
  },
  isLoading: () => spacesStore.isLoading.get(),
  selectedSpace: () => spacesStore.selectedSpace.get(),
  totalCount: () => spacesStore.spaces.get().filter(s => !s.is_deleted).length,
  getSpaceById: (id: string) => {
    const spaces = spacesStore.spaces.get();
    return spaces.find(space => space.id === id && !space.is_deleted) || null;
  },
};

// Actions
export const spacesActions = {
  loadSpaces: async () => {
    await loadSpaces();
  },
  
  setSpaces: (spaces: Space[]) => {
    spacesStore.spaces.set(spaces);
  },

  addSpace: (space: Space) => {
    const currentSpaces = spacesStore.spaces.get();
    spacesStore.spaces.set([...currentSpaces, space]);
  },

  // Add space with Supabase sync
  addSpaceWithSync: async (space: Space) => {
    const currentSpaces = spacesStore.spaces.get();
    spacesStore.spaces.set([...currentSpaces, space]);
    
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify([...currentSpaces, space]));
      
      // Sync with Supabase
      const user = authStore.user.get();
      if (user) {
        await syncOperations.uploadSpace(space, user.id);
      }
    } catch (error) {
      console.error('Error saving space:', error);
    }
  },

  updateSpace: (id: string, updates: Partial<Space>) => {
    const currentSpaces = spacesStore.spaces.get();
    const updatedSpaces = currentSpaces.map(space =>
      space.id === id ? { ...space, ...updates } : space
    );
    spacesStore.spaces.set(updatedSpaces);
  },

  removeSpace: (id: string) => {
    const currentSpaces = spacesStore.spaces.get();
    const filteredSpaces = currentSpaces.filter(space => space.id !== id);
    spacesStore.spaces.set(filteredSpaces);
  },

  // Remove space with Supabase sync (Soft delete)
  removeSpaceWithSync: async (id: string, deleteItems: boolean = false) => {
    console.log(`🗑️ [spacesActions] Starting removeSpaceWithSync (soft delete) for space ${id}, deleteItems: ${deleteItems}`);

    const nowIso = new Date().toISOString();

    // Mark space as deleted locally (keep as tombstone for sync)
    const currentSpaces = spacesStore.spaces.get();
    const updatedSpaces = currentSpaces.map(space =>
      space.id === id ? { ...space, is_deleted: true, deleted_at: nowIso, updated_at: nowIso } : space
    );

    // Store ALL spaces including tombstones
    spacesStore.spaces.set(updatedSpaces);
    console.log(`🗑️ [spacesActions] Soft-deleted space ${id} locally (kept as tombstone)`);

    try {
      // Save ALL spaces including tombstones to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(updatedSpaces));
      console.log(`🗑️ [spacesActions] Updated AsyncStorage with tombstone for space ${id}`);

      // Handle items in this space
      const { itemsActions } = await import('./items');
      if (deleteItems) {
        // Delete all items in this space
        const items = (await import('./items')).itemsStore.items.get();
        const itemsInSpace = items.filter(item => item.space_id === id);
        console.log(`🗑️ [spacesActions] Deleting ${itemsInSpace.length} items in space ${id}`);
        for (const item of itemsInSpace) {
          await itemsActions.removeItemWithSync(item.id);
        }
      } else {
        // Remove space_id from items (move to "Everything")
        const items = (await import('./items')).itemsStore.items.get();
        const itemsInSpace = items.filter(item => item.space_id === id);
        console.log(`🗑️ [spacesActions] Moving ${itemsInSpace.length} items to Everything`);
        for (const item of itemsInSpace) {
          await itemsActions.updateItemWithSync(item.id, { space_id: null });
        }
      }

      // Sync soft delete to Supabase (dynamic import to avoid require cycle)
      const { syncOperations } = await import('../services/syncOperations');
      await syncOperations.softDeleteSpace(id);
      console.log(`🗑️ [spacesActions] Completed soft delete sync for space ${id}`);
    } catch (error) {
      console.error(`🗑️ [spacesActions] Error soft-deleting space ${id}:`, error);
      throw error;
    }
  },

  // Archive space with Supabase sync
  archiveSpaceWithSync: async (id: string) => {
    console.log(`📦 [spacesActions] Archiving space ${id}`);

    const nowIso = new Date().toISOString();
    const currentSpaces = spacesStore.spaces.get();
    const updatedSpaces = currentSpaces.map(space =>
      space.id === id ? {
        ...space,
        is_archived: true,
        archived_at: nowIso,
        updated_at: nowIso
      } : space
    );

    spacesStore.spaces.set(updatedSpaces);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(updatedSpaces));

      // Archive all items in this space
      const { itemsActions } = await import('./items');
      await itemsActions.bulkArchiveItemsInSpace(id);

      // Sync space archive to Supabase
      const { syncOperations } = await import('../services/syncOperations');
      await syncOperations.updateSpace({ ...updatedSpaces.find(s => s.id === id)! });
      console.log(`✅ [spacesActions] Archived space ${id}`);
    } catch (error) {
      console.error(`❌ [spacesActions] Error archiving space ${id}:`, error);
      throw error;
    }
  },

  // Unarchive space with Supabase sync
  unarchiveSpaceWithSync: async (id: string) => {
    console.log(`📂 [spacesActions] Unarchiving space ${id}`);

    const nowIso = new Date().toISOString();
    const currentSpaces = spacesStore.spaces.get();
    const updatedSpaces = currentSpaces.map(space =>
      space.id === id ? {
        ...space,
        is_archived: false,
        archived_at: null,
        updated_at: nowIso
      } : space
    );

    spacesStore.spaces.set(updatedSpaces);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(updatedSpaces));

      // Unarchive auto-archived items in this space
      const { itemsActions } = await import('./items');
      await itemsActions.bulkUnarchiveAutoArchivedItemsInSpace(id);

      // Sync space unarchive to Supabase
      const { syncOperations } = await import('../services/syncOperations');
      await syncOperations.updateSpace({ ...updatedSpaces.find(s => s.id === id)! });
      console.log(`✅ [spacesActions] Unarchived space ${id}`);
    } catch (error) {
      console.error(`❌ [spacesActions] Error unarchiving space ${id}:`, error);
      throw error;
    }
  },

  setLoading: (loading: boolean) => {
    spacesStore.isLoading.set(loading);
  },

  setSelectedSpace: (space: Space | null) => {
    spacesStore.selectedSpace.set(space);
  },

  reset: () => {
    spacesStore.set(initialState);
  },

  clearAll: () => {
    spacesStore.spaces.set([]);
    spacesStore.selectedSpace.set(null);
    console.log('📦 Cleared all spaces from store');
  },

  reorderSpaces: (spaces: Space[]) => {
    spacesStore.spaces.set(spaces);
  },

  reorderSpacesWithSync: async (spaces: Space[]) => {
    // Update local store first
    spacesStore.spaces.set(spaces);

    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(spaces));

      // Sync with Supabase
      const user = authStore.user.get();
      if (user) {
        await syncOperations.updateSpaceOrder(spaces);
      }
    } catch (error) {
      console.error('Error reordering spaces:', error);
      throw error;
    }
  },
};
