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
  youtube_source: 'youtubei' as const,
  youtube_transcript_source: 'youtubei' as const,
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
  youtubeSource: () => adminSettingsStore.settings.get()?.youtube_source ?? DEFAULT_SETTINGS.youtube_source,
  youtubeTranscriptSource: () => adminSettingsStore.settings.get()?.youtube_transcript_source ?? DEFAULT_SETTINGS.youtube_transcript_source,
  isLoading: () => adminSettingsStore.isLoading.get(),
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
      const { error } = await supabase
        .from('admin_settings')
        .update({ [field]: value })
        .eq('id', ADMIN_SETTINGS_ID);

      if (error) {
        console.error('🔧 Error updating admin setting:', error);
        // Revert optimistic update
        if (currentSettings) {
          adminSettingsStore.settings.set(currentSettings);
        }
        throw error;
      }

      console.log(`🔧 Admin setting updated: ${field} =`, value);

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
};

// Auto-load on import (will be called after auth loads)
// Note: This will be called from app/_layout.tsx after auth is ready
