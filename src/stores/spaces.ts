import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Space } from '../types';

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

const STORAGE_KEY = '@memex_spaces';

// Load spaces from storage on initialization
const loadSpaces = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      spacesStore.spaces.set(data.spaces || []);
    }
  } catch (error) {
    console.error('Failed to load spaces:', error);
  }
};

// Save spaces to storage whenever they change
spacesStore.spaces.onChange(() => {
  const spaces = spacesStore.spaces.get();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ spaces })).catch(error => {
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
  setSpaces: (spaces: Space[]) => {
    spacesStore.spaces.set(spaces);
  },

  addSpace: (space: Space) => {
    const currentSpaces = spacesStore.spaces.get();
    spacesStore.spaces.set([...currentSpaces, space]);
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
};
