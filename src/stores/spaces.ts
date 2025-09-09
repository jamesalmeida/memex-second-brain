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
  spaces: () => spacesStore.spaces.get(),
  isLoading: () => spacesStore.isLoading.get(),
  selectedSpace: () => spacesStore.selectedSpace.get(),
  totalCount: () => spacesStore.spaces.get().length,
  getSpaceById: (id: string) => {
    const spaces = spacesStore.spaces.get();
    return spaces.find(space => space.id === id) || null;
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
};
