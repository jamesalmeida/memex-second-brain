import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Item } from '../types';

const STORAGE_KEY_MUTED = 'expandedItemUI_xVideoMuted';
const STORAGE_KEY_AUTOPLAY = 'expandedItemUI_autoplayXVideos';

/**
 * UI state store for managing expanded item sheet visibility and current item
 * This follows the pattern used by chatUI store
 */
export const expandedItemUIStore = observable({
  currentItem: null as Item | null,
  xVideoMuted: true, // Global preference for X video mute state
  autoplayXVideos: true, // Global preference for X video autoplay in grid
  activeVideoPlayer: null as any, // Track the currently active/playing video player globally
});

export const expandedItemUIActions = {
  /**
   * Expand a specific item
   */
  expandItem: (item: Item) => {
    console.log('🚀 [expandedItemUIActions] expandItem called for item:', item.id, item.title);
    expandedItemUIStore.currentItem.set(item);
  },

  /**
   * Close the expanded item sheet
   */
  closeExpandedItem: () => {
    console.log('🚀 [expandedItemUIActions] closeExpandedItem called');
    expandedItemUIStore.currentItem.set(null);
  },

  /**
   * Set X video mute preference
   */
  setXVideoMuted: async (muted: boolean) => {
    try {
      // Guard: only update if value actually changed
      const currentValue = expandedItemUIStore.xVideoMuted.get();
      if (currentValue === muted) {
        console.log('🔇 [xVideoMuted] Skipping update - value unchanged:', muted);
        return;
      }

      console.log('🔇 [xVideoMuted] Setting mute preference:', currentValue, '->', muted);
      expandedItemUIStore.xVideoMuted.set(muted);

      // Save to cloud-synced user settings
      const { userSettingsActions } = require('./userSettings');
      await userSettingsActions.updateSetting('ui_x_video_muted', muted);

      // Also save to legacy AsyncStorage for backward compatibility
      await AsyncStorage.setItem(STORAGE_KEY_MUTED, JSON.stringify(muted));
      console.log('🔇 [xVideoMuted] Saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving X video mute preference:', error);
    }
  },

  /**
   * Load X video mute preference from storage
   */
  loadXVideoMutedPreference: async () => {
    try {
      // First try to load from userSettings (cloud-synced)
      const { userSettingsComputed } = require('./userSettings');
      const mutedFromSettings = userSettingsComputed.xVideoMuted();

      if (mutedFromSettings !== undefined) {
        console.log('🔇 [xVideoMuted] Loaded from userSettings:', mutedFromSettings);
        expandedItemUIStore.xVideoMuted.set(mutedFromSettings);
      } else {
        // Fall back to legacy AsyncStorage
        const saved = await AsyncStorage.getItem(STORAGE_KEY_MUTED);
        if (saved !== null) {
          const value = JSON.parse(saved);
          console.log('🔇 [xVideoMuted] Loaded from AsyncStorage:', value);
          expandedItemUIStore.xVideoMuted.set(value);
        } else {
          console.log('🔇 [xVideoMuted] No saved preference, using default: true');
        }
      }
    } catch (error) {
      console.error('Error loading X video mute preference:', error);
    }
  },

  /**
   * Set X video autoplay preference
   */
  setAutoplayXVideos: async (autoplay: boolean) => {
    try {
      const currentValue = expandedItemUIStore.autoplayXVideos.get();
      if (currentValue === autoplay) {
        return;
      }

      expandedItemUIStore.autoplayXVideos.set(autoplay);

      // Save to cloud-synced user settings
      const { userSettingsActions } = require('./userSettings');
      await userSettingsActions.updateSetting('ui_autoplay_x_videos', autoplay);

      // Also save to legacy AsyncStorage for backward compatibility
      await AsyncStorage.setItem(STORAGE_KEY_AUTOPLAY, JSON.stringify(autoplay));
    } catch (error) {
      console.error('Error saving X video autoplay preference:', error);
    }
  },

  /**
   * Load X video autoplay preference from storage
   */
  loadAutoplayPreference: async () => {
    try {
      // First try to load from userSettings (cloud-synced)
      const { userSettingsComputed } = require('./userSettings');
      const autoplayFromSettings = userSettingsComputed.autoplayXVideos();

      if (autoplayFromSettings !== undefined) {
        expandedItemUIStore.autoplayXVideos.set(autoplayFromSettings);
      } else {
        // Fall back to legacy AsyncStorage
        const saved = await AsyncStorage.getItem(STORAGE_KEY_AUTOPLAY);
        if (saved !== null) {
          const value = JSON.parse(saved);
          expandedItemUIStore.autoplayXVideos.set(value);
        }
      }
    } catch (error) {
      console.error('Error loading X video autoplay preference:', error);
    }
  },
};

// Load preferences on app start
expandedItemUIActions.loadXVideoMutedPreference();
expandedItemUIActions.loadAutoplayPreference();
