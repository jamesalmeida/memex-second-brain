import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpaceChat } from '../types';
import { STORAGE_KEYS } from '../constants';
import { supabase } from '../services/supabase';
import { authStore } from './auth';

interface SpaceChatsState {
  chats: SpaceChat[];
  isLoading: boolean;
}

const initialState: SpaceChatsState = {
  chats: [],
  isLoading: false,
};

export const spaceChatsStore = observable(initialState);

export const spaceChatsComputed = {
  chats: () => spaceChatsStore.chats.get(),
  isLoading: () => spaceChatsStore.isLoading.get(),

  getChatById: (chatId: string): SpaceChat | null => {
    const chats = spaceChatsStore.chats.get();
    return chats.find(c => c.id === chatId) || null;
  },

  getChatBySpaceId: (spaceId: string): SpaceChat | null => {
    const chats = spaceChatsStore.chats.get();
    return chats.find(c => c.space_id === spaceId) || null;
  },
};

export const spaceChatsActions = {
  setChats: async (chats: SpaceChat[]) => {
    spaceChatsStore.chats.set(chats);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SPACE_CHATS, JSON.stringify(chats));
    } catch (error) {
      console.error('Error saving space chats:', error);
    }
  },

  createChat: async (spaceId: string, title?: string): Promise<SpaceChat | null> => {
    const userId = authStore.user.get()?.id;
    if (!userId) {
      console.error('Cannot create space chat: User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('space_chats')
        .insert({
          space_id: spaceId,
          user_id: userId,
          title,
        })
        .select()
        .single();

      if (error) throw error;

      const newChat: SpaceChat = data as SpaceChat;

      const currentChats = spaceChatsStore.chats.get();
      const updatedChats = [...currentChats, newChat];
      await spaceChatsActions.setChats(updatedChats);

      console.log('💬 Created space chat:', newChat.id);
      return newChat;
    } catch (error) {
      console.error('Error creating space chat:', error);
      return null;
    }
  },

  updateChat: async (chatId: string, updates: Partial<SpaceChat>) => {
    try {
      const { error } = await supabase
        .from('space_chats')
        .update(updates)
        .eq('id', chatId);

      if (error) throw error;

      const currentChats = spaceChatsStore.chats.get();
      const updatedChats = currentChats.map(c => (c.id === chatId ? { ...c, ...updates } : c));
      await spaceChatsActions.setChats(updatedChats);

      console.log('💬 Updated space chat:', chatId);
    } catch (error) {
      console.error('Error updating space chat:', error);
    }
  },

  deleteChat: async (chatId: string) => {
    try {
      const { error } = await supabase
        .from('space_chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      const currentChats = spaceChatsStore.chats.get();
      const filteredChats = currentChats.filter(c => c.id !== chatId);
      await spaceChatsActions.setChats(filteredChats);

      console.log('💬 Deleted space chat:', chatId);
    } catch (error) {
      console.error('Error deleting space chat:', error);
    }
  },

  loadChats: async () => {
    try {
      spaceChatsStore.isLoading.set(true);

      const saved = await AsyncStorage.getItem(STORAGE_KEYS.SPACE_CHATS);
      if (saved) {
        const chats = JSON.parse(saved) as SpaceChat[];
        spaceChatsStore.chats.set(chats);
        console.log('💬 Loaded', chats.length, 'space chats from storage');
      }

      await spaceChatsActions.syncFromSupabase();
    } catch (error) {
      console.error('Error loading space chats:', error);
    } finally {
      spaceChatsStore.isLoading.set(false);
    }
  },

  syncFromSupabase: async () => {
    const userId = authStore.user.get()?.id;
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('space_chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chats = data as SpaceChat[];
      await spaceChatsActions.setChats(chats);
      console.log('💬 Synced', chats.length, 'space chats from Supabase');
    } catch (error) {
      console.error('Error syncing space chats from Supabase:', error);
    }
  },

  reset: () => {
    spaceChatsStore.set(initialState);
  },

  clearAll: async () => {
    spaceChatsStore.chats.set([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SPACE_CHATS);
      console.log('💬 Cleared all space chats');
    } catch (error) {
      console.error('Error clearing space chats:', error);
    }
  },
};

// Load chats on app start
spaceChatsActions.loadChats();


