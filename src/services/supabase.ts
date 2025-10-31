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
      .eq('is_deleted', false)
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
      .eq('is_deleted', false)
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

  // Soft delete item (Trash): mark as deleted and set deleted_at
  softDeleteItem: async (id: string) => {
    console.log(`🗑️ [supabase.db] Soft-deleting item ${id} (mark is_deleted=true)`);
    const { data, error } = await supabase
      .from('items')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`🗑️ [supabase.db] Error soft-deleting item ${id}:`, error);
    } else {
      console.log(`✅ [supabase.db] Successfully soft-deleted item ${id}`);
    }

    return { data, error };
  },

  deleteItem: async (id: string) => {
    console.log(`🗑️ [supabase.db] Deleting item ${id} from items table`);
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`🗑️ [supabase.db] Error deleting item ${id}:`, error);
    } else {
      console.log(`✅ [supabase.db] Successfully deleted item ${id} from items table`);
    }

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
    segments?: Array<{ startMs: number; endMs?: number; text: string }>;
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

  // API Usage Tracking
  saveApiUsage: async (usage: {
    api_name: string;
    operation_type: string;
    item_id?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } };
    }

    const { data, error } = await supabase
      .from('api_usage_tracking')
      .insert({
        user_id: user.id,
        api_name: usage.api_name,
        operation_type: usage.operation_type,
        item_id: usage.item_id || null,
      })
      .select()
      .single();

    return { data, error };
  },

  getApiUsageByMonth: async (apiName: string, year: number, month: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } };
    }

    // Get start and end of month in UTC
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const { data, error } = await supabase
      .from('api_usage_tracking')
      .select('id')
      .eq('user_id', user.id)
      .eq('api_name', apiName)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    return { data: data || [], error, count: data?.length || 0 };
  },

  getCurrentMonthApiUsage: async (apiName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' }, count: 0 };
    }

    const now = new Date();
    const startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

    const { data, error } = await supabase
      .from('api_usage_tracking')
      .select('id')
      .eq('user_id', user.id)
      .eq('api_name', apiName)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    return { data: data || [], error, count: data?.length || 0 };
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

// Storage helpers
export const storage = {
  uploadImage: async (bucket: string, path: string, file: Blob | File | Uint8Array | ArrayBuffer, contentType?: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: contentType || 'image/jpeg',
        upsert: true,
      });

    return { data, error };
  },

  getPublicUrl: (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  deleteImage: async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).remove([path]);
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
