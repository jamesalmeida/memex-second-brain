import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, API } from '../constants';

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface AISettingsState {
  selectedModel: string; // For chat
  metadataModel: string; // For metadata extraction/cleaning
  availableModels: OpenAIModel[];
  lastModelsFetch: string | null;
  isLoadingModels: boolean;
  hasApiKey: boolean;
  // Note: autoGenerateTranscripts and autoGenerateImageDescriptions moved to adminSettings (global settings)
}

const initialState: AISettingsState = {
  selectedModel: 'gpt-4o-mini', // Default chat model
  metadataModel: 'gpt-4o-mini', // Default metadata model (most cost-effective)
  availableModels: [],
  lastModelsFetch: null,
  isLoadingModels: false,
  hasApiKey: !!API.OPENAI_API_KEY,
};

export const aiSettingsStore = observable(initialState);

// Computed values
// Note: All AI settings moved to adminSettings (global settings controlled by admin)
// These computed values now delegate to adminSettingsComputed
export const aiSettingsComputed = {
  selectedModel: () => {
    const { adminSettingsComputed } = require('./adminSettings');
    return adminSettingsComputed.aiChatModel();
  },
  metadataModel: () => {
    const { adminSettingsComputed } = require('./adminSettings');
    return adminSettingsComputed.aiMetadataModel();
  },
  availableModels: () => {
    const { adminSettingsComputed } = require('./adminSettings');
    return adminSettingsComputed.aiAvailableModels();
  },
  isLoadingModels: () => aiSettingsStore.isLoadingModels.get(),
  hasApiKey: () => aiSettingsStore.hasApiKey.get(),
  // Note: autoGenerateTranscripts and autoGenerateImageDescriptions moved to adminSettingsComputed

  // Check if models need refresh (24h cache)
  needsRefresh: (): boolean => {
    const { adminSettingsComputed } = require('./adminSettings');
    return adminSettingsComputed.needsRefresh();
  },

  // Get formatted time since last fetch
  timeSinceLastFetch: (): string => {
    const { adminSettingsComputed } = require('./adminSettings');
    return adminSettingsComputed.timeSinceLastFetch();
  },
};

// Actions
// Note: Model selection moved to adminSettings (global settings controlled by admin)
// These actions now delegate to adminSettingsActions
export const aiSettingsActions = {
  setSelectedModel: async (modelId: string) => {
    // Delegate to adminSettings
    const { adminSettingsActions } = require('./adminSettings');
    await adminSettingsActions.setAiChatModel(modelId);
    console.log('🤖 Selected chat model (via adminSettings):', modelId);
  },

  setMetadataModel: async (modelId: string) => {
    // Delegate to adminSettings
    const { adminSettingsActions } = require('./adminSettings');
    await adminSettingsActions.setAiMetadataModel(modelId);
    console.log('🤖 Selected metadata model (via adminSettings):', modelId);
  },

  // Note: setAutoGenerateTranscripts and setAutoGenerateImageDescriptions removed
  // These are now global admin settings managed via adminSettingsActions

  fetchModels: async (force: boolean = false) => {
    // Delegate to adminSettings
    const { adminSettingsActions } = require('./adminSettings');

    try {
      aiSettingsStore.isLoadingModels.set(true);
      await adminSettingsActions.fetchModels(force);
      console.log('🤖 Fetched models (via adminSettings)');
    } catch (error) {
      console.error('🤖 Error fetching models:', error);
      throw error;
    } finally {
      aiSettingsStore.isLoadingModels.set(false);
    }
  },

  // Note: loadModelsFromCache and loadSettings removed
  // Models are now stored in adminSettings and loaded by adminSettingsActions.loadSettings()
  loadSettings: async () => {
    // Settings are now loaded from adminSettings
    // This method is kept for backward compatibility but does nothing
    console.log('🤖 AI settings now loaded from adminSettings (global settings)');
  },

  checkApiKey: () => {
    const hasKey = !!API.OPENAI_API_KEY;
    aiSettingsStore.hasApiKey.set(hasKey);
    return hasKey;
  },

  reset: () => {
    aiSettingsStore.set(initialState);
  },

  clearAll: async () => {
    // Note: AI model settings are now global (stored in adminSettings)
    // We only reset the local loading state, not the global settings
    aiSettingsStore.isLoadingModels.set(false);
    aiSettingsStore.hasApiKey.set(!!API.OPENAI_API_KEY);

    try {
      // Remove legacy AsyncStorage keys (no longer used)
      await AsyncStorage.removeItem(STORAGE_KEYS.AI_SETTINGS);
      await AsyncStorage.removeItem(STORAGE_KEYS.AI_MODELS);
      console.log('🤖 Cleared local AI settings (global settings preserved)');
    } catch (error) {
      console.error('Error clearing AI settings:', error);
    }
  },
};

// NOTE: Settings are loaded by useAuth hook after userSettings loads from database
// Do NOT load here to avoid race condition where aiSettings loads before userSettings
