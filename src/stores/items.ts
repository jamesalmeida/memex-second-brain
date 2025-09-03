import { observable } from '@legendapp/state';
import { Item, SearchFilters } from '../types';

interface ItemsState {
  items: Item[];
  filteredItems: Item[];
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  searchQuery: string;
  filters: SearchFilters;
  selectedItem: Item | null;
}

const initialState: ItemsState = {
  items: [],
  filteredItems: [],
  isLoading: false,
  hasMore: true,
  offset: 0,
  searchQuery: '',
  filters: {},
  selectedItem: null,
};

export const itemsStore = observable(initialState);

// Computed values
export const itemsComputed = {
  items: () => itemsStore.items.get(),
  filteredItems: () => itemsStore.filteredItems.get(),
  isLoading: () => itemsStore.isLoading.get(),
  hasMore: () => itemsStore.hasMore.get(),
  searchQuery: () => itemsStore.searchQuery.get(),
  filters: () => itemsStore.filters.get(),
  selectedItem: () => itemsStore.selectedItem.get(),
  totalCount: () => itemsStore.items.get().length,
  filteredCount: () => itemsStore.filteredItems.get().length,
};

// Actions
export const itemsActions = {
  setItems: (items: Item[]) => {
    itemsStore.items.set(items);
    itemsStore.filteredItems.set(items);
  },

  addItems: (newItems: Item[]) => {
    const currentItems = itemsStore.items.get();
    itemsStore.items.set([...currentItems, ...newItems]);
    itemsStore.filteredItems.set([...currentItems, ...newItems]);
  },

  updateItem: (id: string, updates: Partial<Item>) => {
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems);
  },

  removeItem: (id: string) => {
    const currentItems = itemsStore.items.get();
    const filteredItems = currentItems.filter(item => item.id !== id);
    itemsStore.items.set(filteredItems);
    itemsStore.filteredItems.set(filteredItems);
  },

  setLoading: (loading: boolean) => {
    itemsStore.isLoading.set(loading);
  },

  setHasMore: (hasMore: boolean) => {
    itemsStore.hasMore.set(hasMore);
  },

  setOffset: (offset: number) => {
    itemsStore.offset.set(offset);
  },

  setSearchQuery: (query: string) => {
    itemsStore.searchQuery.set(query);
  },

  setFilters: (filters: SearchFilters) => {
    itemsStore.filters.set(filters);
  },

  setSelectedItem: (item: Item | null) => {
    itemsStore.selectedItem.set(item);
  },

  // Advanced filtering and search
  applyFilters: () => {
    const items = itemsStore.items.get();
    const filters = itemsStore.filters.get();
    const searchQuery = itemsStore.searchQuery.get();

    let filtered = items;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.desc?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.raw_text?.toLowerCase().includes(query)
      );
    }

    // Apply content type filter
    if (filters.contentType) {
      filtered = filtered.filter(item => item.content_type === filters.contentType);
    }

    // Apply archived filter
    if (filters.isArchived !== undefined) {
      filtered = filtered.filter(item => item.is_archived === filters.isArchived);
    }

    itemsStore.filteredItems.set(filtered);
  },

  reset: () => {
    itemsStore.set(initialState);
  },

  clearFilters: () => {
    itemsStore.filters.set({});
    itemsStore.searchQuery.set('');
    itemsStore.filteredItems.set(itemsStore.items.get());
  },
};
