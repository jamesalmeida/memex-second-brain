import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ItemChat } from '../types';
import { STORAGE_KEYS } from '../constants';
import { supabase } from '../services/supabase';
import { authStore } from './auth';

interface ItemChatsState {
  chats: ItemChat[];
  isLoading: boolean;
}

const initialState: ItemChatsState = {
  chats: [],
  isLoading: false,
};

export const itemChatsStore = observable(initialState);

// Computed values
export const itemChatsComputed = {
  chats: () => itemChatsStore.chats.get(),
  isLoading: () => itemChatsStore.isLoading.get(),

  // Get chat by ID
  getChatById: (chatId: string): ItemChat | null => {
    const chats = itemChatsStore.chats.get();
    return chats.find(c => c.id === chatId) || null;
  },

  // Get chat by item ID
  getChatByItemId: (itemId: string): ItemChat | null => {
    const chats = itemChatsStore.chats.get();
    return chats.find(c => c.item_id === itemId) || null;
  },

  // Get all chats for an item (there should typically be only one, but just in case)
  getChatsByItemId: (itemId: string): ItemChat[] => {
    const chats = itemChatsStore.chats.get();
    return chats.filter(c => c.item_id === itemId);
  },

  // Get most recently updated chats
  getRecentChats: (limit: number = 10): ItemChat[] => {
    const chats = itemChatsStore.chats.get();
    return [...chats]
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  },
};

// Actions
export const itemChatsActions = {
  setChats: async (chats: ItemChat[]) => {
    itemChatsStore.chats.set(chats);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEM_CHATS, JSON.stringify(chats));
    } catch (error) {
      console.error('Error saving item chats:', error);
    }
  },

  createChat: async (itemId: string, title?: string): Promise<ItemChat | null> => {
    const userId = authStore.user.get()?.id;
    if (!userId) {
      console.error('Cannot create chat: User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('item_chats')
        .insert({
          item_id: itemId,
          user_id: userId,
          title,
        })
        .select()
        .single();

      if (error) throw error;

      const newChat: ItemChat = data as ItemChat;

      // Add to local store
      const currentChats = itemChatsStore.chats.get();
      const updatedChats = [...currentChats, newChat];
      await itemChatsActions.setChats(updatedChats);

      console.log('💬 Created item chat:', newChat.id);
      return newChat;
    } catch (error) {
      console.error('Error creating item chat:', error);
      return null;
    }
  },

  updateChat: async (chatId: string, updates: Partial<ItemChat>) => {
    try {
      const { error } = await supabase
        .from('item_chats')
        .update(updates)
        .eq('id', chatId);

      if (error) throw error;

      // Update local store
      const currentChats = itemChatsStore.chats.get();
      const updatedChats = currentChats.map(c =>
        c.id === chatId ? { ...c, ...updates } : c
      );
      await itemChatsActions.setChats(updatedChats);

      console.log('💬 Updated item chat:', chatId);
    } catch (error) {
      console.error('Error updating item chat:', error);
    }
  },

  deleteChat: async (chatId: string) => {
    try {
      // Delete from Supabase (messages will be cascade deleted)
      const { error } = await supabase
        .from('item_chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      // Remove from local store
      const currentChats = itemChatsStore.chats.get();
      const filteredChats = currentChats.filter(c => c.id !== chatId);
      await itemChatsActions.setChats(filteredChats);

      console.log('💬 Deleted item chat:', chatId);
    } catch (error) {
      console.error('Error deleting item chat:', error);
    }
  },

  loadChats: async () => {
    try {
      itemChatsStore.isLoading.set(true);

      // Load from AsyncStorage first
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ITEM_CHATS);
      if (saved) {
        const chats = JSON.parse(saved) as ItemChat[];
        itemChatsStore.chats.set(chats);
        console.log('💬 Loaded', chats.length, 'item chats from storage');
      }

      // Then sync from Supabase
      await itemChatsActions.syncFromSupabase();
    } catch (error) {
      console.error('Error loading item chats:', error);
    } finally {
      itemChatsStore.isLoading.set(false);
    }
  },

  syncFromSupabase: async () => {
    const userId = authStore.user.get()?.id;
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('item_chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chats = data as ItemChat[];
      await itemChatsActions.setChats(chats);
      console.log('💬 Synced', chats.length, 'item chats from Supabase');
    } catch (error) {
      console.error('Error syncing item chats from Supabase:', error);
    }
  },

  reset: () => {
    itemChatsStore.set(initialState);
  },

  clearAll: async () => {
    itemChatsStore.chats.set([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ITEM_CHATS);
      console.log('💬 Cleared all item chats');
    } catch (error) {
      console.error('Error clearing item chats:', error);
    }
  },
};

// Load chats on app start
itemChatsActions.loadChats();
