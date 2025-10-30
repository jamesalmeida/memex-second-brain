import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import { UserSettings } from '../types';
import { supabase } from '../services/supabase';
import { authStore } from './auth';

interface UserSettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  lastSyncTime: string | null;
}

const DEFAULT_SETTINGS = {
  theme_dark_mode: false,
  ai_chat_model: 'gpt-4o-mini',
  ai_metadata_model: 'gpt-4o-mini',
  ai_auto_transcripts: false,
  ai_auto_image_descriptions: false,
  ui_x_video_muted: true,
  ui_autoplay_x_videos: true,
  ui_radial_actions: ['chat', 'share', 'archive'] as const, // Default actions
};

const initialState: UserSettingsState = {
  settings: null,
  isLoading: true,
  lastSyncTime: null,
};

export const userSettingsStore = observable(initialState);

// Computed values
export const userSettingsComputed = {
  // Theme
  isDarkMode: () => userSettingsStore.settings.get()?.theme_dark_mode ?? DEFAULT_SETTINGS.theme_dark_mode,

  // AI
  chatModel: () => userSettingsStore.settings.get()?.ai_chat_model ?? DEFAULT_SETTINGS.ai_chat_model,
  metadataModel: () => userSettingsStore.settings.get()?.ai_metadata_model ?? DEFAULT_SETTINGS.ai_metadata_model,
  autoTranscripts: () => userSettingsStore.settings.get()?.ai_auto_transcripts ?? DEFAULT_SETTINGS.ai_auto_transcripts,
  autoImageDescriptions: () => userSettingsStore.settings.get()?.ai_auto_image_descriptions ?? DEFAULT_SETTINGS.ai_auto_image_descriptions,

  // UI
  xVideoMuted: () => userSettingsStore.settings.get()?.ui_x_video_muted ?? DEFAULT_SETTINGS.ui_x_video_muted,
  autoplayXVideos: () => userSettingsStore.settings.get()?.ui_autoplay_x_videos ?? DEFAULT_SETTINGS.ui_autoplay_x_videos,
  radialActions: () => userSettingsStore.settings.get()?.ui_radial_actions ?? DEFAULT_SETTINGS.ui_radial_actions,

  isLoading: () => userSettingsStore.isLoading.get(),
};

// Actions
export const userSettingsActions = {
  /**
   * Load settings from Supabase (cloud-first)
   * Falls back to AsyncStorage if offline or not found
   */
  loadSettings: async () => {
    try {
      const user = authStore.user.get();
      if (!user) {
        console.log('⚙️ No user logged in, skipping settings load');
        userSettingsStore.isLoading.set(false);
        return;
      }

      console.log('⚙️ Loading settings for user:', user.id);

      // Try to load from Supabase first
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine for first-time users
        console.error('⚙️ Error loading settings from Supabase:', error);
        // Fall back to AsyncStorage
        await userSettingsActions.loadFromAsyncStorage();
      } else if (data) {
        console.log('⚙️ Settings loaded from Supabase');
        userSettingsStore.settings.set(data);
        userSettingsStore.lastSyncTime.set(new Date().toISOString());

        // Cache to AsyncStorage for offline access
        await AsyncStorage.setItem(
          STORAGE_KEYS.USER_SETTINGS,
          JSON.stringify(data)
        );
      } else {
        console.log('⚙️ No settings found in Supabase, creating defaults');
        // No settings found, create defaults
        await userSettingsActions.createDefaultSettings();
      }
    } catch (error) {
      console.error('⚙️ Error loading settings:', error);
      // Fall back to AsyncStorage
      await userSettingsActions.loadFromAsyncStorage();
    } finally {
      userSettingsStore.isLoading.set(false);
    }
  },

  /**
   * Load settings from AsyncStorage (offline fallback)
   */
  loadFromAsyncStorage: async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      if (cached) {
        const settings = JSON.parse(cached);
        userSettingsStore.settings.set(settings);
        console.log('⚙️ Settings loaded from AsyncStorage');
      } else {
        console.log('⚙️ No cached settings in AsyncStorage');
      }
    } catch (error) {
      console.error('⚙️ Error loading from AsyncStorage:', error);
    }
  },

  /**
   * Create default settings for new user
   */
  createDefaultSettings: async () => {
    const user = authStore.user.get();
    if (!user) return;

    const newSettings: Partial<UserSettings> = {
      user_id: user.id,
      ...DEFAULT_SETTINGS,
    };

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .insert(newSettings)
        .select()
        .single();

      if (error) {
        console.error('⚙️ Error creating default settings:', error);
        return;
      }

      console.log('⚙️ Default settings created');
      userSettingsStore.settings.set(data);
      userSettingsStore.lastSyncTime.set(new Date().toISOString());

      // Cache to AsyncStorage
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_SETTINGS,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('⚙️ Error creating default settings:', error);
    }
  },

  /**
   * Update a single setting field
   */
  updateSetting: async <K extends keyof UserSettings>(
    field: K,
    value: UserSettings[K]
  ) => {
    const user = authStore.user.get();
    if (!user) return;

    const currentSettings = userSettingsStore.settings.get();
    if (!currentSettings) {
      console.error('⚙️ No settings loaded, cannot update');
      return;
    }

    // Optimistic update
    const updatedSettings = {
      ...currentSettings,
      [field]: value,
      updated_at: new Date().toISOString(),
    };
    userSettingsStore.settings.set(updatedSettings);

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('user_settings')
        .update({ [field]: value })
        .eq('user_id', user.id);

      if (error) {
        console.error('⚙️ Error updating setting in Supabase:', error);
        // Revert optimistic update
        userSettingsStore.settings.set(currentSettings);
        return;
      }

      console.log(`⚙️ Setting updated: ${String(field)} = ${value}`);
      userSettingsStore.lastSyncTime.set(new Date().toISOString());

      // Update AsyncStorage cache
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_SETTINGS,
        JSON.stringify(updatedSettings)
      );
    } catch (error) {
      console.error('⚙️ Error updating setting:', error);
      // Revert optimistic update
      userSettingsStore.settings.set(currentSettings);
    }
  },

  /**
   * Batch update multiple settings
   */
  updateSettings: async (updates: Partial<UserSettings>) => {
    const user = authStore.user.get();
    if (!user) return;

    const currentSettings = userSettingsStore.settings.get();
    if (!currentSettings) {
      console.error('⚙️ No settings loaded, cannot update');
      return;
    }

    // Optimistic update
    const updatedSettings = {
      ...currentSettings,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    userSettingsStore.settings.set(updatedSettings);

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        console.error('⚙️ Error updating settings in Supabase:', error);
        // Revert optimistic update
        userSettingsStore.settings.set(currentSettings);
        return;
      }

      console.log('⚙️ Settings updated:', Object.keys(updates));
      userSettingsStore.lastSyncTime.set(new Date().toISOString());

      // Update AsyncStorage cache
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_SETTINGS,
        JSON.stringify(updatedSettings)
      );
    } catch (error) {
      console.error('⚙️ Error updating settings:', error);
      // Revert optimistic update
      userSettingsStore.settings.set(currentSettings);
    }
  },

  /**
   * Force sync settings from Supabase
   */
  syncFromCloud: async () => {
    const user = authStore.user.get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine for first-time users
        console.error('⚙️ Error syncing from cloud:', error);
        return;
      }

      if (data) {
        userSettingsStore.settings.set(data);
        userSettingsStore.lastSyncTime.set(new Date().toISOString());

        // Update cache
        await AsyncStorage.setItem(
          STORAGE_KEYS.USER_SETTINGS,
          JSON.stringify(data)
        );

        console.log('⚙️ Settings synced from cloud');
      } else {
        console.log('⚙️ No settings found in cloud, will create on first change');
      }
    } catch (error) {
      console.error('⚙️ Error syncing from cloud:', error);
    }
  },

  /**
   * Clear settings (on logout)
   */
  clearSettings: async () => {
    userSettingsStore.settings.set(null);
    userSettingsStore.lastSyncTime.set(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_SETTINGS);
      console.log('⚙️ Settings cleared');
    } catch (error) {
      console.error('⚙️ Error clearing settings:', error);
    }
  },

  /**
   * Reset settings to defaults
   */
  resetToDefaults: async () => {
    const user = authStore.user.get();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update(DEFAULT_SETTINGS)
        .eq('user_id', user.id);

      if (error) {
        console.error('⚙️ Error resetting settings:', error);
        return;
      }

      // Reload settings
      await userSettingsActions.loadSettings();
      console.log('⚙️ Settings reset to defaults');
    } catch (error) {
      console.error('⚙️ Error resetting settings:', error);
    }
  },
};

// Initialize on import - will load when user is available
// Actual loading happens in app/_layout.tsx after auth check
