import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, ChatType, ChatMessageMetadata } from '../types';
import { STORAGE_KEYS } from '../constants';
import { supabase } from '../services/supabase';
import uuid from 'react-native-uuid';

interface ChatMessagesState {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
}

const initialState: ChatMessagesState = {
  messages: [],
  isLoading: false,
  isSending: false,
};

export const chatMessagesStore = observable(initialState);

// Computed values
export const chatMessagesComputed = {
  messages: () => chatMessagesStore.messages.get(),
  isLoading: () => chatMessagesStore.isLoading.get(),
  isSending: () => chatMessagesStore.isSending.get(),

  // Get messages for a specific chat
  getMessagesByChatId: (chatId: string, limit?: number): ChatMessage[] => {
    const messages = chatMessagesStore.messages.get();
    const filtered = messages
      .filter(m => m.chat_id === chatId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (limit) {
      return filtered.slice(-limit); // Get last N messages
    }

    return filtered;
  },

  // Get message count for a chat
  getMessageCount: (chatId: string): number => {
    const messages = chatMessagesStore.messages.get();
    return messages.filter(m => m.chat_id === chatId).length;
  },

  // Get latest message in a chat
  getLatestMessage: (chatId: string): ChatMessage | null => {
    const messages = chatMessagesComputed.getMessagesByChatId(chatId);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  },

  // Calculate total tokens used in a chat
  getTotalTokens: (chatId: string): { prompt: number; completion: number; total: number } => {
    const messages = chatMessagesStore.messages.get();
    const chatMessages = messages.filter(m => m.chat_id === chatId);

    return chatMessages.reduce(
      (acc, msg) => {
        if (msg.metadata?.tokens) {
          acc.prompt += msg.metadata.tokens.prompt || 0;
          acc.completion += msg.metadata.tokens.completion || 0;
          acc.total += msg.metadata.tokens.total || 0;
        }
        return acc;
      },
      { prompt: 0, completion: 0, total: 0 }
    );
  },
};

// Actions
export const chatMessagesActions = {
  setMessages: async (messages: ChatMessage[]) => {
    chatMessagesStore.messages.set(messages);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving chat messages:', error);
    }
  },

  addMessage: async (
    chatId: string,
    chatType: ChatType,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ChatMessageMetadata
  ): Promise<ChatMessage | null> => {
    try {
      const newMessage: ChatMessage = {
        id: uuid.v4() as string,
        chat_id: chatId,
        chat_type: chatType,
        role,
        content,
        created_at: new Date().toISOString(),
        metadata: metadata || {},
      };

      // Add to Supabase
      const { error } = await supabase.from('chat_messages').insert({
        id: newMessage.id,
        chat_id: newMessage.chat_id,
        chat_type: newMessage.chat_type,
        role: newMessage.role,
        content: newMessage.content,
        created_at: newMessage.created_at,
        metadata: newMessage.metadata,
      });

      if (error) throw error;

      // Add to local store
      const currentMessages = chatMessagesStore.messages.get();
      const updatedMessages = [...currentMessages, newMessage];
      await chatMessagesActions.setMessages(updatedMessages);

      console.log('💬 Added message to chat:', chatId);
      return newMessage;
    } catch (error) {
      console.error('Error adding message:', error);
      return null;
    }
  },

  // Optimistically add a message (for UI responsiveness)
  addMessageOptimistic: async (
    chatId: string,
    chatType: ChatType,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ChatMessageMetadata
  ): Promise<ChatMessage> => {
    const newMessage: ChatMessage = {
      id: uuid.v4() as string,
      chat_id: chatId,
      chat_type: chatType,
      role,
      content,
      created_at: new Date().toISOString(),
      metadata: metadata || {},
    };

    // Add to local store immediately
    const currentMessages = chatMessagesStore.messages.get();
    const updatedMessages = [...currentMessages, newMessage];
    chatMessagesStore.messages.set(updatedMessages);

    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error saving messages to AsyncStorage:', error);
    }

    // Sync to Supabase
    try {
      const { error } = await supabase.from('chat_messages').insert({
        id: newMessage.id,
        chat_id: newMessage.chat_id,
        chat_type: newMessage.chat_type,
        role: newMessage.role,
        content: newMessage.content,
        created_at: newMessage.created_at,
        metadata: newMessage.metadata,
      });

      if (error) {
        console.error('Error syncing message to Supabase:', error);
        console.error('Message details:', {
          chat_id: newMessage.chat_id,
          chat_type: newMessage.chat_type,
          role: newMessage.role,
        });
      }
    } catch (error) {
      console.error('Error syncing message to Supabase:', error);
    }

    return newMessage;
  },

  updateMessage: async (messageId: string, updates: Partial<ChatMessage>) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update(updates)
        .eq('id', messageId);

      if (error) throw error;

      // Update local store
      const currentMessages = chatMessagesStore.messages.get();
      const updatedMessages = currentMessages.map(m =>
        m.id === messageId ? { ...m, ...updates } : m
      );
      await chatMessagesActions.setMessages(updatedMessages);

      console.log('💬 Updated message:', messageId);
    } catch (error) {
      console.error('Error updating message:', error);
    }
  },

  deleteMessage: async (messageId: string) => {
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);

      if (error) throw error;

      // Remove from local store
      const currentMessages = chatMessagesStore.messages.get();
      const filteredMessages = currentMessages.filter(m => m.id !== messageId);
      await chatMessagesActions.setMessages(filteredMessages);

      console.log('💬 Deleted message:', messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  },

  // Delete all messages for a chat
  deleteMessagesByChat: async (chatId: string) => {
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('chat_id', chatId);

      if (error) throw error;

      // Remove from local store
      const currentMessages = chatMessagesStore.messages.get();
      const filteredMessages = currentMessages.filter(m => m.chat_id !== chatId);
      await chatMessagesActions.setMessages(filteredMessages);

      console.log('💬 Deleted all messages for chat:', chatId);
    } catch (error) {
      console.error('Error deleting messages:', error);
    }
  },

  loadMessages: async () => {
    try {
      chatMessagesStore.isLoading.set(true);

      // Load from AsyncStorage first
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
      if (saved) {
        const messages = JSON.parse(saved) as ChatMessage[];
        chatMessagesStore.messages.set(messages);
        console.log('💬 Loaded', messages.length, 'messages from storage');
      }

      // Then sync from Supabase
      await chatMessagesActions.syncFromSupabase();
    } catch (error) {
      console.error('Error loading chat messages:', error);
    } finally {
      chatMessagesStore.isLoading.set(false);
    }
  },

  // Load messages for a specific chat with pagination
  loadMessagesForChat: async (chatId: string, limit: number = 50) => {
    try {
      chatMessagesStore.isLoading.set(true);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const messages = (data as ChatMessage[]).reverse(); // Reverse to get chronological order

      // Merge with existing messages
      const currentMessages = chatMessagesStore.messages.get();
      const otherMessages = currentMessages.filter(m => m.chat_id !== chatId);
      const updatedMessages = [...otherMessages, ...messages];
      await chatMessagesActions.setMessages(updatedMessages);

      console.log('💬 Loaded', messages.length, 'messages for chat:', chatId);
      return messages;
    } catch (error) {
      console.error('Error loading messages for chat:', error);
      return [];
    } finally {
      chatMessagesStore.isLoading.set(false);
    }
  },

  syncFromSupabase: async () => {
    try {
      // Sync recent messages only (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messages = data as ChatMessage[];
      await chatMessagesActions.setMessages(messages);
      console.log('💬 Synced', messages.length, 'messages from Supabase');
    } catch (error) {
      console.error('Error syncing messages from Supabase:', error);
    }
  },

  setIsSending: (isSending: boolean) => {
    chatMessagesStore.isSending.set(isSending);
  },

  reset: () => {
    chatMessagesStore.set(initialState);
  },

  clearAll: async () => {
    chatMessagesStore.messages.set([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
      console.log('💬 Cleared all chat messages');
    } catch (error) {
      console.error('Error clearing chat messages:', error);
    }
  },
};

// Load messages on app start
chatMessagesActions.loadMessages();
