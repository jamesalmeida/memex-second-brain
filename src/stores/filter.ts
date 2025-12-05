import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContentType, Item } from '../types';
import { STORAGE_KEYS } from '../constants';

export type SortOrder = 'recent' | 'oldest';

interface FilterState {
  sortOrder: SortOrder;
  selectedContentType: ContentType | null;
  selectedTags: string[];
  selectedSpaceId: string | null;
  showArchived: boolean;
}

const initialState: FilterState = {
  sortOrder: 'recent',
  selectedContentType: null,
  selectedTags: [],
  selectedSpaceId: null,
  showArchived: false,
};

export const filterStore = observable(initialState);

// Computed values
export const filterComputed = {
  sortOrder: () => filterStore.sortOrder.get(),
  selectedContentType: () => filterStore.selectedContentType.get(),
  selectedTags: () => filterStore.selectedTags.get(),
  selectedSpaceId: () => filterStore.selectedSpaceId.get(),
  showArchived: () => filterStore.showArchived.get(),
  hasActiveFilters: () => {
    const type = filterStore.selectedContentType.get();
    const tags = filterStore.selectedTags.get();
    const spaceId = filterStore.selectedSpaceId.get();
    const archived = filterStore.showArchived.get();
    return type !== null || tags.length > 0 || spaceId !== null || archived;
  },
  /**
   * Filter items based on space only.
   * This is useful for showing only relevant types and tags in the filter UI.
   */
  getItemsFilteredBySpace: (items: Item[]) => {
    const selectedSpaceId = filterStore.selectedSpaceId.get();

    // Filter out deleted and archived items
    let filtered = items.filter(item => !item.is_deleted && !item.is_archived);

    // Apply space filter if active
    if (selectedSpaceId !== null) {
      filtered = filtered.filter(item => item.space_id === selectedSpaceId);
    }

    return filtered;
  },
  /**
   * Filter items based on space and content type (not tags).
   * This is useful for showing only relevant tags in the filter UI.
   */
  getItemsFilteredBySpaceAndContentType: (items: Item[]) => {
    const selectedContentType = filterStore.selectedContentType.get();
    const selectedSpaceId = filterStore.selectedSpaceId.get();

    // Filter out deleted and archived items
    let filtered = items.filter(item => !item.is_deleted && !item.is_archived);

    // Apply space filter if active
    if (selectedSpaceId !== null) {
      filtered = filtered.filter(item => item.space_id === selectedSpaceId);
    }

    // Apply content type filter if active
    if (selectedContentType !== null) {
      filtered = filtered.filter(item => {
        // Treat 'podcast' and 'podcast_episode' as equivalent
        if (selectedContentType === 'podcast') {
          return item.content_type === 'podcast' || item.content_type === 'podcast_episode';
        }
        return item.content_type === selectedContentType;
      });
    }

    return filtered;
  },
  /**
   * Filter items based on content type only (not tags).
   * This is useful for showing only relevant tags in the filter UI.
   * @deprecated Use getItemsFilteredBySpaceAndContentType instead for proper cascading filters
   */
  getItemsFilteredByContentType: (items: Item[]) => {
    const selectedContentType = filterStore.selectedContentType.get();

    // Filter out deleted and archived items
    let filtered = items.filter(item => !item.is_deleted && !item.is_archived);

    // Apply content type filter if active
    if (selectedContentType !== null) {
      filtered = filtered.filter(item => {
        // Treat 'podcast' and 'podcast_episode' as equivalent
        if (selectedContentType === 'podcast') {
          return item.content_type === 'podcast' || item.content_type === 'podcast_episode';
        }
        return item.content_type === selectedContentType;
      });
    }

    return filtered;
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

  // Content type (single selection)
  setContentType: async (contentType: ContentType | null) => {
    filterStore.selectedContentType.set(contentType);
    await filterActions.persist();
  },

  selectContentType: async (contentType: ContentType) => {
    // If clicking the same type, deselect it
    const current = filterStore.selectedContentType.get();
    if (current === contentType) {
      filterStore.selectedContentType.set(null);
    } else {
      filterStore.selectedContentType.set(contentType);
    }
    await filterActions.persist();
  },

  clearContentType: async () => {
    filterStore.selectedContentType.set(null);
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

  // Space filter
  setSelectedSpace: async (spaceId: string | null) => {
    filterStore.selectedSpaceId.set(spaceId);
    // When selecting a space, turn off archive view
    if (spaceId !== null) {
      filterStore.showArchived.set(false);
    }
    await filterActions.persist();
  },

  clearSelectedSpace: async () => {
    filterStore.selectedSpaceId.set(null);
    await filterActions.persist();
  },

  // Archive filter
  setShowArchived: async (show: boolean) => {
    filterStore.showArchived.set(show);
    // When showing archive, clear space selection
    if (show) {
      filterStore.selectedSpaceId.set(null);
    }
    await filterActions.persist();
  },

  toggleArchived: async () => {
    const current = filterStore.showArchived.get();
    await filterActions.setShowArchived(!current);
  },

  // Clear all filters
  clearAll: async () => {
    filterStore.selectedContentType.set(null);
    filterStore.selectedTags.set([]);
    filterStore.selectedSpaceId.set(null);
    filterStore.showArchived.set(false);
    // Keep sort order
    await filterActions.persist();
  },

  // Persistence
  persist: async () => {
    try {
      const state = {
        sortOrder: filterStore.sortOrder.get(),
        selectedContentType: filterStore.selectedContentType.get(),
        selectedTags: filterStore.selectedTags.get(),
        selectedSpaceId: filterStore.selectedSpaceId.get(),
        showArchived: filterStore.showArchived.get(),
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
        filterStore.selectedContentType.set(parsed.selectedContentType || null);
        filterStore.selectedTags.set(parsed.selectedTags || []);
        filterStore.selectedSpaceId.set(parsed.selectedSpaceId || null);
        filterStore.showArchived.set(parsed.showArchived || false);
      }
    } catch (error) {
      console.error('Error loading filter state:', error);
    }
  },
};
