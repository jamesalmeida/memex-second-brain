import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@memex_console_log_settings';

/**
 * Console Log Settings Store
 *
 * Manages granular control over console logging throughout the app.
 * Each category can be toggled independently, with a master toggle to disable all logs.
 */

export interface ConsoleLogSettings {
  // Master toggle - when false, all console logs are disabled
  enabled: boolean;

  // Individual category toggles
  categories: {
    sync: boolean;                  // Sync & Offline Queue operations
    chat: boolean;                  // Chat & Messaging
    auth: boolean;                  // Authentication & Login
    transcripts: boolean;           // Transcript Generation
    drawer: boolean;                // Drawer & Bottom Sheets
    items: boolean;                 // Item Saving & Creation
    enrichment: boolean;            // Enrichment Pipeline
    api: boolean;                   // External API Integration
    metadata: boolean;              // Data Metadata & Storage
    navigation: boolean;            // UI/Navigation & Drawer Context
    admin: boolean;                 // Admin Settings & Configuration
    images: boolean;                // Image Operations & Uploads
  };
}

const defaultSettings: ConsoleLogSettings = {
  enabled: true,
  categories: {
    sync: true,
    chat: true,
    auth: true,
    transcripts: true,
    drawer: true,
    items: true,
    enrichment: true,
    api: true,
    metadata: true,
    navigation: true,
    admin: true,
    images: true,
  },
};

export const consoleLogSettingsStore = observable<ConsoleLogSettings>(defaultSettings);

// Actions for updating console log settings
export const consoleLogSettingsActions = {
  /**
   * Load settings from AsyncStorage
   */
  async loadSettings() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        consoleLogSettingsStore.set(settings);
      }
    } catch (error) {
      console.error('Error loading console log settings:', error);
    }
  },

  /**
   * Save settings to AsyncStorage
   */
  async saveSettings() {
    try {
      const settings = consoleLogSettingsStore.get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving console log settings:', error);
    }
  },

  /**
   * Enable or disable all console logs
   */
  async setEnabled(enabled: boolean) {
    consoleLogSettingsStore.enabled.set(enabled);
    await this.saveSettings();
  },

  /**
   * Enable or disable a specific category
   */
  async setCategoryEnabled(category: keyof ConsoleLogSettings['categories'], enabled: boolean) {
    consoleLogSettingsStore.categories[category].set(enabled);
    await this.saveSettings();
  },

  /**
   * Enable all categories
   */
  async enableAll() {
    consoleLogSettingsStore.enabled.set(true);
    Object.keys(consoleLogSettingsStore.categories.get()).forEach((key) => {
      consoleLogSettingsStore.categories[key as keyof ConsoleLogSettings['categories']].set(true);
    });
    await this.saveSettings();
  },

  /**
   * Disable all categories
   */
  async disableAll() {
    Object.keys(consoleLogSettingsStore.categories.get()).forEach((key) => {
      consoleLogSettingsStore.categories[key as keyof ConsoleLogSettings['categories']].set(false);
    });
    await this.saveSettings();
  },

  /**
   * Reset to default settings
   */
  async reset() {
    consoleLogSettingsStore.set(defaultSettings);
    await this.saveSettings();
  },
};

// Computed values
export const consoleLogSettingsComputed = {
  /**
   * Check if a specific category is enabled (respects master toggle)
   */
  isCategoryEnabled(category: keyof ConsoleLogSettings['categories']): boolean {
    return consoleLogSettingsStore.enabled.get() && consoleLogSettingsStore.categories[category].get();
  },

  /**
   * Check if the master toggle is enabled
   */
  isEnabled(): boolean {
    return consoleLogSettingsStore.enabled.get();
  },

  /**
   * Get count of enabled categories
   */
  getEnabledCount(): number {
    if (!consoleLogSettingsStore.enabled.get()) {
      return 0;
    }
    return Object.values(consoleLogSettingsStore.categories.get()).filter(Boolean).length;
  },

  /**
   * Get count of total categories
   */
  getTotalCount(): number {
    return Object.keys(consoleLogSettingsStore.categories.get()).length;
  },
};

// Initialize settings on app start
consoleLogSettingsActions.loadSettings();
