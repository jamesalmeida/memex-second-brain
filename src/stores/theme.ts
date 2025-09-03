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
      themeStore.isDarkMode.set(isDark);
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify({ isDarkMode: isDark }));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  },

  loadThemePreference: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      if (saved) {
        const { isDarkMode } = JSON.parse(saved);
        themeStore.isDarkMode.set(isDarkMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      themeStore.isLoading.set(false);
    }
  },

  toggleTheme: () => {
    const current = themeStore.isDarkMode.get();
    themeActions.setDarkMode(!current);
  },
};

// Initialize theme on app start
themeActions.loadThemePreference();
