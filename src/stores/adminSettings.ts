import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdminSettings } from '../types';
import { supabase } from '../services/supabase';
import { authStore } from './auth';

const STORAGE_KEY = '@memex_admin_settings';
const ADMIN_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

interface AdminSettingsState {
  settings: AdminSettings | null;
  isLoading: boolean;
  lastSyncTime: string | null;
}

const DEFAULT_SETTINGS = {
  auto_generate_transcripts: false,
  auto_generate_image_descriptions: false,
  auto_generate_tldr: false,
  ai_chat_model: 'gpt-4o-mini',
  ai_metadata_model: 'gpt-4o-mini',
  ai_available_models: [],
  ai_last_models_fetch: null,
  youtube_source: 'youtubei' as const,
  youtube_transcript_source: 'youtubei' as const,
  ui_show_description: false,
};

const initialState: AdminSettingsState = {
  settings: null,
  isLoading: true,
  lastSyncTime: null,
};

export const adminSettingsStore = observable(initialState);

// Computed values
export const adminSettingsComputed = {
  autoGenerateTranscripts: () => adminSettingsStore.settings.get()?.auto_generate_transcripts ?? DEFAULT_SETTINGS.auto_generate_transcripts,
  autoGenerateImageDescriptions: () => adminSettingsStore.settings.get()?.auto_generate_image_descriptions ?? DEFAULT_SETTINGS.auto_generate_image_descriptions,
  autoGenerateTldr: () => adminSettingsStore.settings.get()?.auto_generate_tldr ?? DEFAULT_SETTINGS.auto_generate_tldr,
  aiChatModel: () => adminSettingsStore.settings.get()?.ai_chat_model ?? DEFAULT_SETTINGS.ai_chat_model,
  aiMetadataModel: () => adminSettingsStore.settings.get()?.ai_metadata_model ?? DEFAULT_SETTINGS.ai_metadata_model,
  aiAvailableModels: () => adminSettingsStore.settings.get()?.ai_available_models ?? DEFAULT_SETTINGS.ai_available_models,
  aiLastModelsFetch: () => adminSettingsStore.settings.get()?.ai_last_models_fetch ?? DEFAULT_SETTINGS.ai_last_models_fetch,
  youtubeSource: () => adminSettingsStore.settings.get()?.youtube_source ?? DEFAULT_SETTINGS.youtube_source,
  youtubeTranscriptSource: () => adminSettingsStore.settings.get()?.youtube_transcript_source ?? DEFAULT_SETTINGS.youtube_transcript_source,
  showDescription: () => adminSettingsStore.settings.get()?.ui_show_description ?? DEFAULT_SETTINGS.ui_show_description,
  isLoading: () => adminSettingsStore.isLoading.get(),

  // Check if models need refresh (24h cache)
  needsRefresh: (): boolean => {
    const lastFetch = adminSettingsStore.settings.get()?.ai_last_models_fetch;
    if (!lastFetch) return true;

    const lastFetchTime = new Date(lastFetch).getTime();
    const now = new Date().getTime();
    const hoursSinceLastFetch = (now - lastFetchTime) / (1000 * 60 * 60);

    return hoursSinceLastFetch >= 24;
  },

  // Get formatted time since last fetch
  timeSinceLastFetch: (): string => {
    const lastFetch = adminSettingsStore.settings.get()?.ai_last_models_fetch;
    if (!lastFetch) return 'Never';

    const lastFetchTime = new Date(lastFetch).getTime();
    const now = new Date().getTime();
    const minutesAgo = Math.floor((now - lastFetchTime) / (1000 * 60));

    if (minutesAgo < 60) return `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`;

    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;
  },
};

// Actions
export const adminSettingsActions = {
  /**
   * Load global admin settings from Supabase (cloud-first)
   * Falls back to AsyncStorage if offline or not found
   */
  loadSettings: async () => {
    try {
      const user = authStore.user.get();
      if (!user) {
        console.log('🔧 No user logged in, skipping admin settings load');
        adminSettingsStore.isLoading.set(false);
        return;
      }

      console.log('🔧 Loading global admin settings');

      // Load the single global row from Supabase
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', ADMIN_SETTINGS_ID)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        console.error('🔧 Error loading admin settings from Supabase:', error);
        // Fall back to AsyncStorage
        await adminSettingsActions.loadFromAsyncStorage();
      } else if (data) {
        console.log('🔧 Admin settings loaded from Supabase');
        adminSettingsStore.settings.set(data);
        adminSettingsStore.lastSyncTime.set(new Date().toISOString());

        // Cache to AsyncStorage for offline access
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        console.log('🔧 No admin settings found in Supabase (should have been created by migration)');
        // Fall back to AsyncStorage
        await adminSettingsActions.loadFromAsyncStorage();
      }
    } catch (error) {
      console.error('🔧 Error loading admin settings:', error);
      // Fall back to AsyncStorage
      await adminSettingsActions.loadFromAsyncStorage();
    } finally {
      adminSettingsStore.isLoading.set(false);
    }
  },

  /**
   * Load settings from AsyncStorage (offline fallback)
   */
  loadFromAsyncStorage: async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        console.log('🔧 Loaded admin settings from AsyncStorage cache');
        adminSettingsStore.settings.set(JSON.parse(cached));
      } else {
        console.log('🔧 No cached admin settings, using defaults');
      }
    } catch (error) {
      console.error('🔧 Error loading admin settings from AsyncStorage:', error);
    }
  },

  /**
   * Update a single admin setting field
   * Only admins can modify (enforced by RLS)
   */
  updateSetting: async (field: keyof Omit<AdminSettings, 'id' | 'created_at' | 'updated_at'>, value: any) => {
    try {
      const user = authStore.user.get();
      if (!user) {
        console.error('🔧 Cannot update admin settings: No user logged in');
        return;
      }

      // Optimistic update
      const currentSettings = adminSettingsStore.settings.get();
      if (currentSettings) {
        adminSettingsStore.settings.set({
          ...currentSettings,
          [field]: value,
        });
      }

      // Update in Supabase (RLS will check if user is admin)
      console.log(`🔧 Attempting to update admin setting: ${field} =`, value, 'for user:', user.id);
      const { data, error } = await supabase
        .from('admin_settings')
        .update({ [field]: value })
        .eq('id', ADMIN_SETTINGS_ID)
        .select();

      if (error) {
        console.error('🔧 ❌ ERROR updating admin setting:', {
          field,
          value,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        // Revert optimistic update
        if (currentSettings) {
          adminSettingsStore.settings.set(currentSettings);
        }
        throw error;
      }

      console.log(`🔧 ✅ Admin setting updated successfully: ${field} =`, value, 'Response:', data);

      // Update AsyncStorage cache
      const updatedSettings = adminSettingsStore.settings.get();
      if (updatedSettings) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
      }

      adminSettingsStore.lastSyncTime.set(new Date().toISOString());
    } catch (error) {
      console.error('🔧 Error updating admin setting:', error);
      throw error;
    }
  },

  /**
   * Update multiple admin settings at once
   */
  updateSettings: async (updates: Partial<Omit<AdminSettings, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const user = authStore.user.get();
      if (!user) {
        console.error('🔧 Cannot update admin settings: No user logged in');
        return;
      }

      // Optimistic update
      const currentSettings = adminSettingsStore.settings.get();
      if (currentSettings) {
        adminSettingsStore.settings.set({
          ...currentSettings,
          ...updates,
        });
      }

      // Update in Supabase (RLS will check if user is admin)
      const { error } = await supabase
        .from('admin_settings')
        .update(updates)
        .eq('id', ADMIN_SETTINGS_ID);

      if (error) {
        console.error('🔧 Error updating admin settings:', error);
        // Revert optimistic update
        if (currentSettings) {
          adminSettingsStore.settings.set(currentSettings);
        }
        throw error;
      }

      console.log('🔧 Admin settings updated:', Object.keys(updates));

      // Update AsyncStorage cache
      const updatedSettings = adminSettingsStore.settings.get();
      if (updatedSettings) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
      }

      adminSettingsStore.lastSyncTime.set(new Date().toISOString());
    } catch (error) {
      console.error('🔧 Error updating admin settings:', error);
      throw error;
    }
  },

  /**
   * Convenience methods for specific settings
   */
  setAutoGenerateTranscripts: async (enabled: boolean) => {
    await adminSettingsActions.updateSetting('auto_generate_transcripts', enabled);
  },

  setAutoGenerateImageDescriptions: async (enabled: boolean) => {
    await adminSettingsActions.updateSetting('auto_generate_image_descriptions', enabled);
  },

  setAutoGenerateTldr: async (enabled: boolean) => {
    await adminSettingsActions.updateSetting('auto_generate_tldr', enabled);
  },

  setYouTubeSource: async (source: 'youtubei' | 'serpapi') => {
    await adminSettingsActions.updateSetting('youtube_source', source);
  },

  setYouTubeTranscriptSource: async (source: 'youtubei' | 'serpapi') => {
    await adminSettingsActions.updateSetting('youtube_transcript_source', source);
  },

  setShowDescription: async (enabled: boolean) => {
    await adminSettingsActions.updateSetting('ui_show_description', enabled);
  },

  setAiChatModel: async (modelId: string) => {
    await adminSettingsActions.updateSetting('ai_chat_model', modelId);
  },

  setAiMetadataModel: async (modelId: string) => {
    await adminSettingsActions.updateSetting('ai_metadata_model', modelId);
  },

  /**
   * Fetch available models from OpenAI API
   * @param force - Force refresh even if cache is still valid
   */
  fetchModels: async (force: boolean = false) => {
    // Check if we need to refresh
    if (!force && !adminSettingsComputed.needsRefresh()) {
      console.log('🔧 Using cached models list');
      return;
    }

    const { API } = require('../constants');
    if (!API.OPENAI_API_KEY) {
      console.warn('🔧 OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    try {
      console.log('🔧 Fetching available models from OpenAI...');

      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();

      // Filter to only chat-compatible models (gpt-* models)
      const chatModels = data.data
        .filter((model: any) =>
          model.id.startsWith('gpt-') &&
          !model.id.includes('instruct') && // Exclude instruct models
          !model.id.includes('vision') // Vision models handled separately
        )
        .sort((a: any, b: any) => {
          // Sort by model version (newer first)
          if (a.id.includes('4') && !b.id.includes('4')) return -1;
          if (!a.id.includes('4') && b.id.includes('4')) return 1;
          return b.created - a.created;
        });

      // Update admin settings with new models
      await adminSettingsActions.updateSettings({
        ai_available_models: chatModels,
        ai_last_models_fetch: new Date().toISOString(),
      });

      console.log(`🔧 Fetched ${chatModels.length} chat models`);
    } catch (error) {
      console.error('🔧 Error fetching models:', error);
      throw error;
    }
  },
};

// Auto-load on import (will be called after auth loads)
// Note: This will be called from app/_layout.tsx after auth is ready
