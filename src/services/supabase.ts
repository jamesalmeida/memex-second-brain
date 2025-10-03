import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE } from '../constants';
import { Database } from '../types/database';

console.log('🔍 Creating Supabase client with URL:', SUPABASE.URL.substring(0, 30) + '...');

export const supabase = createClient<Database>(
  SUPABASE.URL,
  SUPABASE.ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // Enable for OAuth redirects
      flowType: 'pkce', // Recommended for mobile
    },
  }
);

// Test the connection
supabase.auth.getSession().then(({ data, error }) => {
  console.log('🔍 Supabase connection test:', error ? '❌ Error' : '✅ OK', error?.message || '');
});

// Auth helpers
export const auth = {
  signUp: async (email: string, password: string) => {
    console.log('🔍 Creating new account for:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    console.log('🔍 Sign up result:', { hasUser: !!data.user, error: error?.message });
    return { data, error };
  },

  signIn: async (email: string, password: string) => {
    console.log('🔍 Signing in user:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('🔍 Sign in result:', { hasUser: !!data.user, error: error?.message });
    return { data, error };
  },

  getSession: async () => {
    return await supabase.auth.getSession();
  },

  onAuthStateChange: (callback: (event: any, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: () => {
    return supabase.auth.getUser();
  },

  getSession: () => {
    return supabase.auth.getSession();
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helpers
export const db = {
  // Items
  getItems: async (userId: string, limit = 20, offset = 0) => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        item_metadata (*),
        item_type_metadata (*),
        item_spaces (
          spaces (*)
        )
      `)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data, error };
  },

  searchItems: async (userId: string, query: string, limit = 20, offset = 0) => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        item_metadata (*),
        item_type_metadata (*),
        item_spaces (
          spaces (*)
        )
      `)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .or(`title.ilike.%${query}%,desc.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data, error };
  },

  createItem: async (item: Omit<Database['public']['Tables']['items']['Insert'], 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('items')
      .insert(item)
      .select()
      .single();

    return { data, error };
  },

  updateItem: async (id: string, updates: Database['public']['Tables']['items']['Update']) => {
    const { data, error } = await supabase
      .from('items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  deleteItem: async (id: string) => {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Video Transcripts (supports multiple platforms)
  getVideoTranscript: async (itemId: string) => {
    const { data, error } = await supabase
      .from('video_transcripts')
      .select('*')
      .eq('item_id', itemId)
      .single();

    return { data, error };
  },

  getVideoTranscriptsByPlatform: async (platform: string) => {
    const { data, error } = await supabase
      .from('video_transcripts')
      .select('*')
      .eq('platform', platform)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  saveVideoTranscript: async (transcript: {
    item_id: string;
    transcript: string;
    platform: string;
    language: string;
    duration?: number;
  }) => {
    const { data, error } = await supabase
      .from('video_transcripts')
      .upsert({
        ...transcript,
        fetched_at: new Date().toISOString(),
      })
      .select()
      .single();

    return { data, error };
  },

  deleteVideoTranscript: async (itemId: string) => {
    const { error } = await supabase
      .from('video_transcripts')
      .delete()
      .eq('item_id', itemId);

    return { error };
  },

  // Image descriptions
  saveImageDescription: async (description: {
    item_id: string;
    image_url: string;
    description: string;
    model: string;
  }) => {
    const { data, error } = await supabase
      .from('image_descriptions')
      .upsert({
        ...description,
        fetched_at: new Date().toISOString(),
      })
      .select()
      .single();

    return { data, error };
  },

  deleteImageDescription: async (itemId: string, imageUrl?: string) => {
    let query = supabase.from('image_descriptions').delete().eq('item_id', itemId);

    // If imageUrl is provided, delete specific description, otherwise delete all for item
    if (imageUrl) {
      query = query.eq('image_url', imageUrl);
    }

    const { error } = await query;
    return { error };
  },

  // Spaces
  getSpaces: async (userId: string) => {
    const { data, error } = await supabase
      .from('spaces')
      .select(`
        *,
        item_spaces (
          items!inner (id)
        )
      `)
      .eq('user_id', userId);

    return { data, error };
  },

  createSpace: async (space: Omit<Database['public']['Tables']['spaces']['Insert'], 'id'>) => {
    const { data, error } = await supabase
      .from('spaces')
      .insert(space)
      .select()
      .single();

    return { data, error };
  },

  // Chat
  getChatMessages: async (chatId: string, chatType: 'item' | 'space') => {
    const table = chatType === 'item' ? 'item_chats' : 'space_chats';
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .eq('chat_type', chatType)
      .order('created_at', { ascending: true });

    return { data, error };
  },

  createChatMessage: async (message: Database['public']['Tables']['chat_messages']['Insert']) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(message)
      .select()
      .single();

    return { data, error };
  },
};

// Real-time subscriptions
export const subscriptions = {
  items: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  spaces: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('spaces')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spaces',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },
};
