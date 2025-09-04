import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Item, SearchFilters } from '../types';
import { STORAGE_KEYS } from '../constants';

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
  setItems: async (items: Item[]) => {
    itemsStore.items.set(items);
    itemsStore.filteredItems.set(items);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  },

  addItems: async (newItems: Item[]) => {
    const currentItems = itemsStore.items.get();
    const updatedItems = [...currentItems, ...newItems];
    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  },

  updateItem: async (id: string, updates: Partial<Item>) => {
    const currentItems = itemsStore.items.get();
    const updatedItems = currentItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    itemsStore.items.set(updatedItems);
    itemsStore.filteredItems.set(updatedItems);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  },

  removeItem: async (id: string) => {
    const currentItems = itemsStore.items.get();
    const filteredItems = currentItems.filter(item => item.id !== id);
    itemsStore.items.set(filteredItems);
    itemsStore.filteredItems.set(filteredItems);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(filteredItems));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
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

  loadItems: async () => {
    try {
      const savedItems = await AsyncStorage.getItem(STORAGE_KEYS.ITEMS);
      if (savedItems) {
        const items = JSON.parse(savedItems) as Item[];
        itemsStore.items.set(items);
        itemsStore.filteredItems.set(items);
        console.log('📚 Loaded', items.length, 'items from storage');
      }
    } catch (error) {
      console.error('Error loading items from storage:', error);
    }
  },
};

// Load items on app start
itemsActions.loadItems();
