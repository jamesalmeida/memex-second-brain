import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

interface ThemeState {
  isDarkMode: boolean;
  showMockData: boolean;
  isLoading: boolean;
}

const initialState: ThemeState = {
  isDarkMode: false,
  showMockData: true,
  isLoading: true,
};

export const themeStore = observable(initialState);

// Actions
export const themeActions = {
  setDarkMode: async (isDark: boolean) => {
    try {
      console.log('🎨 Setting dark mode to:', isDark);
      themeStore.isDarkMode.set(isDark);
      const currentSettings = {
        isDarkMode: isDark,
        showMockData: themeStore.showMockData.get(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(currentSettings));
      console.log('🎨 Theme saved successfully');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  },

  setShowMockData: async (show: boolean) => {
    try {
      console.log('📦 Setting show mock data to:', show);
      themeStore.showMockData.set(show);
      const currentSettings = {
        isDarkMode: themeStore.isDarkMode.get(),
        showMockData: show,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(currentSettings));
      console.log('📦 Mock data preference saved successfully');
    } catch (error) {
      console.error('Error saving mock data preference:', error);
    }
  },
  
  clearThemePreference: async () => {
    try {
      console.log('🎨 Clearing theme preference...');
      await AsyncStorage.removeItem(STORAGE_KEYS.THEME);
      themeStore.isDarkMode.set(false);
      themeStore.showMockData.set(true);
      console.log('🎨 Theme cleared, reset to defaults');
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
        const settings = JSON.parse(saved);
        console.log('🎨 Setting dark mode to:', settings.isDarkMode);
        console.log('📦 Setting show mock data to:', settings.showMockData);
        themeStore.isDarkMode.set(settings.isDarkMode);
        themeStore.showMockData.set(settings.showMockData ?? true);
      } else {
        console.log('🎨 No saved theme preference, using defaults');
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
