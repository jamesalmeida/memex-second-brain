import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

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
  setDarkMode: async (isDark: boolean) => {
    try {
      console.log('🎨 Setting dark mode to:', isDark);
      themeStore.isDarkMode.set(isDark);
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
      console.log('🎨 Theme cleared, reset to light mode');
    } catch (error) {
      console.error('Error clearing theme preference:', error);
    }
  },

  loadThemePreference: async () => {
    try {
      console.log('🎨 Loading theme preference...');
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      console.log('🎨 Saved theme data:', saved);
      if (saved) {
        const { isDarkMode } = JSON.parse(saved);
        console.log('🎨 Setting dark mode to:', isDarkMode);
        themeStore.isDarkMode.set(isDarkMode);
      } else {
        console.log('🎨 No saved theme preference, using default (light)');
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
themeActions.loadThemePreference();
