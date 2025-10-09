import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContentType } from '../types';
import { STORAGE_KEYS } from '../constants';

export type SortOrder = 'recent' | 'oldest';

interface FilterState {
  sortOrder: SortOrder;
  selectedContentTypes: ContentType[];
  selectedTags: string[];
}

const initialState: FilterState = {
  sortOrder: 'recent',
  selectedContentTypes: [],
  selectedTags: [],
};

export const filterStore = observable(initialState);

// Computed values
export const filterComputed = {
  sortOrder: () => filterStore.sortOrder.get(),
  selectedContentTypes: () => filterStore.selectedContentTypes.get(),
  selectedTags: () => filterStore.selectedTags.get(),
  hasActiveFilters: () => {
    const types = filterStore.selectedContentTypes.get();
    const tags = filterStore.selectedTags.get();
    return types.length > 0 || tags.length > 0;
  },
};

// Actions
export const filterActions = {
  // Sort order
  setSortOrder: async (order: SortOrder) => {
    filterStore.sortOrder.set(order);
    await filterActions.persist();
  },

  toggleSortOrder: async () => {
    const current = filterStore.sortOrder.get();
    const newOrder: SortOrder = current === 'recent' ? 'oldest' : 'recent';
    filterStore.sortOrder.set(newOrder);
    await filterActions.persist();
  },

  // Content types
  toggleContentType: async (contentType: ContentType) => {
    const current = filterStore.selectedContentTypes.get();
    const exists = current.includes(contentType);

    if (exists) {
      filterStore.selectedContentTypes.set(current.filter(t => t !== contentType));
    } else {
      filterStore.selectedContentTypes.set([...current, contentType]);
    }

    await filterActions.persist();
  },

  clearContentTypes: async () => {
    filterStore.selectedContentTypes.set([]);
    await filterActions.persist();
  },

  // Tags
  toggleTag: async (tag: string) => {
    const current = filterStore.selectedTags.get();
    const exists = current.includes(tag);

    if (exists) {
      filterStore.selectedTags.set(current.filter(t => t !== tag));
    } else {
      filterStore.selectedTags.set([...current, tag]);
    }

    await filterActions.persist();
  },

  clearTags: async () => {
    filterStore.selectedTags.set([]);
    await filterActions.persist();
  },

  // Clear all filters
  clearAll: async () => {
    filterStore.selectedContentTypes.set([]);
    filterStore.selectedTags.set([]);
    // Keep sort order
    await filterActions.persist();
  },

  // Persistence
  persist: async () => {
    try {
      const state = {
        sortOrder: filterStore.sortOrder.get(),
        selectedContentTypes: filterStore.selectedContentTypes.get(),
        selectedTags: filterStore.selectedTags.get(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(state));
    } catch (error) {
      console.error('Error persisting filter state:', error);
    }
  },

  load: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FILTERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        filterStore.sortOrder.set(parsed.sortOrder || 'recent');
        filterStore.selectedContentTypes.set(parsed.selectedContentTypes || []);
        filterStore.selectedTags.set(parsed.selectedTags || []);
      }
    } catch (error) {
      console.error('Error loading filter state:', error);
    }
  },
};
