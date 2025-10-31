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
export const aiSettingsComputed = {
  selectedModel: () => aiSettingsStore.selectedModel.get(),
  metadataModel: () => aiSettingsStore.metadataModel.get(),
  availableModels: () => aiSettingsStore.availableModels.get(),
  isLoadingModels: () => aiSettingsStore.isLoadingModels.get(),
  hasApiKey: () => aiSettingsStore.hasApiKey.get(),
  // Note: autoGenerateTranscripts and autoGenerateImageDescriptions moved to adminSettingsComputed

  // Check if models need refresh (24h cache)
  needsRefresh: (): boolean => {
    const lastFetch = aiSettingsStore.lastModelsFetch.get();
    if (!lastFetch) return true;

    const lastFetchTime = new Date(lastFetch).getTime();
    const now = new Date().getTime();
    const hoursSinceLastFetch = (now - lastFetchTime) / (1000 * 60 * 60);

    return hoursSinceLastFetch >= 24;
  },

  // Get formatted time since last fetch
  timeSinceLastFetch: (): string => {
    const lastFetch = aiSettingsStore.lastModelsFetch.get();
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
export const aiSettingsActions = {
  setSelectedModel: async (modelId: string) => {
    aiSettingsStore.selectedModel.set(modelId);
    try {
      // Save to cloud-synced user settings
      const { userSettingsActions } = require('./userSettings');
      await userSettingsActions.updateSetting('ai_chat_model', modelId);

      // Also save to legacy AsyncStorage for backward compatibility
      const settings = {
        selectedModel: modelId,
        metadataModel: aiSettingsStore.metadataModel.get(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(settings));
      console.log('🤖 Selected chat model:', modelId);
    } catch (error) {
      console.error('Error saving selected model:', error);
    }
  },

  setMetadataModel: async (modelId: string) => {
    aiSettingsStore.metadataModel.set(modelId);
    try {
      // Save to cloud-synced user settings
      const { userSettingsActions } = require('./userSettings');
      await userSettingsActions.updateSetting('ai_metadata_model', modelId);

      // Also save to legacy AsyncStorage for backward compatibility
      const settings = {
        selectedModel: aiSettingsStore.selectedModel.get(),
        metadataModel: modelId,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(settings));
      console.log('🤖 Selected metadata model:', modelId);
    } catch (error) {
      console.error('Error saving metadata model:', error);
    }
  },

  // Note: setAutoGenerateTranscripts and setAutoGenerateImageDescriptions removed
  // These are now global admin settings managed via adminSettingsActions

  fetchModels: async (force: boolean = false) => {
    // Check if we need to refresh
    if (!force && !aiSettingsComputed.needsRefresh()) {
      console.log('🤖 Using cached models list');
      return;
    }

    if (!API.OPENAI_API_KEY) {
      console.warn('🤖 OpenAI API key not configured');
      return;
    }

    try {
      aiSettingsStore.isLoadingModels.set(true);
      console.log('🤖 Fetching available models from OpenAI...');

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
        .filter((model: OpenAIModel) =>
          model.id.startsWith('gpt-') &&
          !model.id.includes('instruct') && // Exclude instruct models
          !model.id.includes('vision') // Vision models handled separately
        )
        .sort((a: OpenAIModel, b: OpenAIModel) => {
          // Sort by model version (newer first)
          if (a.id.includes('4') && !b.id.includes('4')) return -1;
          if (!a.id.includes('4') && b.id.includes('4')) return 1;
          return b.created - a.created;
        });

      aiSettingsStore.availableModels.set(chatModels);
      aiSettingsStore.lastModelsFetch.set(new Date().toISOString());

      // Save to AsyncStorage for offline access
      await AsyncStorage.setItem(
        STORAGE_KEYS.AI_MODELS,
        JSON.stringify({
          models: chatModels,
          lastFetch: new Date().toISOString(),
        })
      );

      console.log(`🤖 Fetched ${chatModels.length} chat models`);
    } catch (error) {
      console.error('🤖 Error fetching models:', error);
      // Try to load from cache if fetch fails
      await aiSettingsActions.loadModelsFromCache();
    } finally {
      aiSettingsStore.isLoadingModels.set(false);
    }
  },

  loadModelsFromCache: async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.AI_MODELS);
      if (cached) {
        const { models, lastFetch } = JSON.parse(cached);
        aiSettingsStore.availableModels.set(models);
        aiSettingsStore.lastModelsFetch.set(lastFetch);
        console.log('🤖 Loaded cached models list');
      }
    } catch (error) {
      console.error('Error loading cached models:', error);
    }
  },

  loadSettings: async () => {
    try {
      // First try to load from userSettings (cloud-synced)
      const { userSettingsComputed } = require('./userSettings');

      const chatModel = userSettingsComputed.chatModel();
      const metadataModel = userSettingsComputed.metadataModel();

      if (chatModel) {
        aiSettingsStore.selectedModel.set(chatModel);
      }
      if (metadataModel) {
        aiSettingsStore.metadataModel.set(metadataModel);
      }

      // Fall back to legacy AsyncStorage if userSettings not available
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
      if (saved) {
        const settings = JSON.parse(saved);
        // Only use legacy settings if not already set from userSettings
        if (!chatModel && settings.selectedModel) {
          aiSettingsStore.selectedModel.set(settings.selectedModel);
        }
        if (!metadataModel && settings.metadataModel) {
          aiSettingsStore.metadataModel.set(settings.metadataModel);
        }
      }

      // Load cached models
      await aiSettingsActions.loadModelsFromCache();

      // Fetch fresh models if cache is stale (but don't block)
      if (aiSettingsComputed.needsRefresh()) {
        aiSettingsActions.fetchModels(false).catch(console.error);
      }

      console.log('🤖 AI settings loaded');
    } catch (error) {
      console.error('Error loading AI settings:', error);
    }
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
    aiSettingsStore.set(initialState);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AI_SETTINGS);
      await AsyncStorage.removeItem(STORAGE_KEYS.AI_MODELS);
      console.log('🤖 Cleared all AI settings');
    } catch (error) {
      console.error('Error clearing AI settings:', error);
    }
  },
};

// NOTE: Settings are loaded by useAuth hook after userSettings loads from database
// Do NOT load here to avoid race condition where aiSettings loads before userSettings
