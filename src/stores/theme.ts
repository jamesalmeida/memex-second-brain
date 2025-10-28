import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import { userSettingsActions, userSettingsComputed } from './userSettings';

interface ThemeState {
  isDarkMode: boolean;
  isLoading: boolean;
}

const initialState: ThemeState = {
  isDarkMode: false,
  isLoading: true,
};

export const themeStore = observable(initialState);

// Actions
export const themeActions = {
  /**
   * Set dark mode preference
   * Now syncs to cloud via userSettings store
   */
  setDarkMode: async (isDark: boolean) => {
    try {
      console.log('🎨 Setting dark mode to:', isDark);
      themeStore.isDarkMode.set(isDark);

      // Save to cloud-synced user settings
      await userSettingsActions.updateSetting('theme_dark_mode', isDark);

      // Also save to legacy AsyncStorage for backward compatibility
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify({ isDarkMode: isDark }));
      console.log('🎨 Theme saved successfully');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  },

  clearThemePreference: async () => {
    try {
      console.log('🎨 Clearing theme preference...');
      await AsyncStorage.removeItem(STORAGE_KEYS.THEME);
      themeStore.isDarkMode.set(false);
      console.log('🎨 Theme cleared, reset to defaults');
    } catch (error) {
      console.error('Error clearing theme preference:', error);
    }
  },

  /**
   * Load theme preference
   * Now reads from cloud-synced userSettings if available
   */
  loadThemePreference: async () => {
    try {
      console.log('🎨 Loading theme preference...');

      // First try to get from userSettings (cloud-synced)
      const isDarkMode = userSettingsComputed.isDarkMode();

      if (isDarkMode !== undefined) {
        console.log('🎨 Loading theme from userSettings:', isDarkMode);
        themeStore.isDarkMode.set(isDarkMode);
      } else {
        // Fall back to legacy AsyncStorage
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
        console.log('🎨 Saved theme data from AsyncStorage:', saved);
        if (saved) {
          const settings = JSON.parse(saved);
          console.log('🎨 Setting dark mode to:', settings.isDarkMode);
          themeStore.isDarkMode.set(settings.isDarkMode);
        } else {
          console.log('🎨 No saved theme preference, using defaults');
        }
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      themeStore.isLoading.set(false);
    }
  },

  toggleTheme: () => {
    const current = themeStore.isDarkMode.get();
    console.log('🎨 Toggling theme from', current, 'to', !current);
    themeActions.setDarkMode(!current);
  },
};

// Initialize theme on app start
// Note: Actual loading happens after userSettings are loaded in app/_layout.tsx
themeActions.loadThemePreference();