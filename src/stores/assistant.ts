import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import { supabase } from '../services/supabase';
import { STORAGE_KEYS } from '../constants';

// Types for assistant chat
export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: {
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    tool_calls?: Array<{
      id: string;
      name: string;
      arguments: string;
    }>;
    tool_results?: Array<{
      tool_call_id: string;
      result: string;
    }>;
  };
}

export interface AssistantConversation {
  id: string;
  user_id: string;
  title: string;
  messages: AssistantMessage[];
  created_at: string;
  updated_at: string;
}

interface AssistantState {
  conversations: AssistantConversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  isSending: boolean;
}

// Initial state
const initialState: AssistantState = {
  conversations: [],
  currentConversationId: null,
  isLoading: false,
  isSending: false,
};

// Create observable store
export const assistantStore = observable<AssistantState>(initialState);

// Helper to save conversations to AsyncStorage
const saveConversations = async (conversations: AssistantConversation[]) => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.ASSISTANT_CONVERSATIONS,
      JSON.stringify(conversations)
    );
  } catch (error) {
    console.error('🤖 [Assistant] Error saving conversations:', error);
  }
};

// Load conversations from AsyncStorage
const loadConversations = async (): Promise<AssistantConversation[]> => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.ASSISTANT_CONVERSATIONS);
    if (saved) {
      const conversations = JSON.parse(saved);
      console.log(`🤖 [Assistant] Loaded ${conversations.length} conversations from storage`);
      return conversations;
    }
  } catch (error) {
    console.error('🤖 [Assistant] Error loading conversations:', error);
  }
  return [];
};

// Computed values
export const assistantComputed = {
  currentConversation: (): AssistantConversation | null => {
    const currentId = assistantStore.currentConversationId.get();
    if (!currentId) return null;
    return assistantStore.conversations.get().find(c => c.id === currentId) || null;
  },

  currentMessages: (): AssistantMessage[] => {
    const conversation = assistantComputed.currentConversation();
    return conversation?.messages || [];
  },

  sortedConversations: (): AssistantConversation[] => {
    return [...assistantStore.conversations.get()].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },
};

// Actions
export const assistantActions = {
  // Initialize store by loading from AsyncStorage
  init: async () => {
    const conversations = await loadConversations();
    assistantStore.conversations.set(conversations);
  },

  // Create a new conversation
  createConversation: async (title?: string): Promise<AssistantConversation> => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    const conversation: AssistantConversation = {
      id: uuid.v4() as string,
      user_id: userId,
      title: title || 'New Chat',
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedConversations = [...assistantStore.conversations.get(), conversation];
    assistantStore.conversations.set(updatedConversations);
    assistantStore.currentConversationId.set(conversation.id);

    // Save to AsyncStorage
    await saveConversations(updatedConversations);

    console.log('🤖 [Assistant] Created new conversation:', conversation.id);
    return conversation;
  },

  // Set current conversation
  setCurrentConversation: (conversationId: string | null) => {
    assistantStore.currentConversationId.set(conversationId);
  },

  // Add a message to current conversation
  addMessage: async (message: Omit<AssistantMessage, 'id' | 'created_at'>): Promise<AssistantMessage> => {
    const currentId = assistantStore.currentConversationId.get();
    if (!currentId) {
      throw new Error('No current conversation');
    }

    const newMessage: AssistantMessage = {
      ...message,
      id: uuid.v4() as string,
      created_at: new Date().toISOString(),
    };

    const updatedConversations = assistantStore.conversations.get().map(conv => {
      if (conv.id === currentId) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          updated_at: new Date().toISOString(),
        };
      }
      return conv;
    });

    assistantStore.conversations.set(updatedConversations);

    // Save to AsyncStorage
    await saveConversations(updatedConversations);

    console.log('🤖 [Assistant] Added message:', newMessage.role, newMessage.id);
    return newMessage;
  },

  // Update conversation title
  updateTitle: async (conversationId: string, title: string) => {
    const updatedConversations = assistantStore.conversations.get().map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          title,
          updated_at: new Date().toISOString(),
        };
      }
      return conv;
    });

    assistantStore.conversations.set(updatedConversations);

    // Save to AsyncStorage
    await saveConversations(updatedConversations);
  },

  // Delete a conversation
  deleteConversation: async (conversationId: string) => {
    const updatedConversations = assistantStore.conversations.get().filter(
      conv => conv.id !== conversationId
    );

    assistantStore.conversations.set(updatedConversations);

    // If deleted conversation was current, clear it
    if (assistantStore.currentConversationId.get() === conversationId) {
      assistantStore.currentConversationId.set(null);
    }

    // Save to AsyncStorage
    await saveConversations(updatedConversations);

    console.log('🤖 [Assistant] Deleted conversation:', conversationId);
  },

  // Clear all messages in current conversation
  clearCurrentConversation: async () => {
    const currentId = assistantStore.currentConversationId.get();
    if (!currentId) return;

    const updatedConversations = assistantStore.conversations.get().map(conv => {
      if (conv.id === currentId) {
        return {
          ...conv,
          messages: [],
          updated_at: new Date().toISOString(),
        };
      }
      return conv;
    });

    assistantStore.conversations.set(updatedConversations);

    // Save to AsyncStorage
    await saveConversations(updatedConversations);

    console.log('🤖 [Assistant] Cleared conversation:', currentId);
  },

  // Set loading state
  setLoading: (isLoading: boolean) => {
    assistantStore.isLoading.set(isLoading);
  },

  // Set sending state
  setSending: (isSending: boolean) => {
    assistantStore.isSending.set(isSending);
  },

  // Ensure there's an active conversation (create one if not)
  ensureConversation: async (): Promise<AssistantConversation> => {
    const current = assistantComputed.currentConversation();
    if (current) return current;

    // Try to use most recent conversation
    const sorted = assistantComputed.sortedConversations();
    if (sorted.length > 0) {
      assistantStore.currentConversationId.set(sorted[0].id);
      return sorted[0];
    }

    // Create new conversation
    return assistantActions.createConversation();
  },

  // Start a new chat (creates new conversation and sets it as current)
  startNewChat: async (): Promise<AssistantConversation> => {
    return assistantActions.createConversation();
  },
};

// Auto-initialize on module load
assistantActions.init().catch(error => {
  console.error('🤖 [Assistant] Failed to initialize:', error);
});
