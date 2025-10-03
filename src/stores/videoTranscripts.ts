import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoTranscript, VideoPlatform } from '../types';
import { STORAGE_KEYS } from '../constants';
import { syncOperations } from '../services/syncOperations';

interface VideoTranscriptsState {
  transcripts: VideoTranscript[];
  isLoading: boolean;
  generatingForItems: string[]; // Track which items are currently being processed
}

const initialState: VideoTranscriptsState = {
  transcripts: [],
  isLoading: false,
  generatingForItems: [],
};

export const videoTranscriptsStore = observable(initialState);

// Computed values
export const videoTranscriptsComputed = {
  transcripts: () => videoTranscriptsStore.transcripts.get(),
  isLoading: () => videoTranscriptsStore.isLoading.get(),
  generatingForItems: () => videoTranscriptsStore.generatingForItems.get(),

  // Get transcript by item ID
  getTranscriptByItemId: (itemId: string): VideoTranscript | null => {
    const transcripts = videoTranscriptsStore.transcripts.get();
    return transcripts.find(t => t.item_id === itemId) || null;
  },

  // Get transcripts by platform
  getTranscriptsByPlatform: (platform: VideoPlatform): VideoTranscript[] => {
    const transcripts = videoTranscriptsStore.transcripts.get();
    return transcripts.filter(t => t.platform === platform);
  },

  // Check if item has transcript
  hasTranscript: (itemId: string): boolean => {
    const transcripts = videoTranscriptsStore.transcripts.get();
    return transcripts.some(t => t.item_id === itemId);
  },

  // Check if transcript is currently being generated for an item
  isGenerating: (itemId: string): boolean => {
    const generatingItems = videoTranscriptsStore.generatingForItems.get();
    return generatingItems.includes(itemId);
  },
};

// Actions
export const videoTranscriptsActions = {
  setTranscripts: async (transcripts: VideoTranscript[]) => {
    videoTranscriptsStore.transcripts.set(transcripts);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS, JSON.stringify(transcripts));
    } catch (error) {
      console.error('Error saving video transcripts:', error);
    }
  },

  addTranscript: async (transcript: VideoTranscript) => {
    const currentTranscripts = videoTranscriptsStore.transcripts.get();
    
    // Check if transcript already exists for this item
    const existingIndex = currentTranscripts.findIndex(t => t.item_id === transcript.item_id);
    
    let updatedTranscripts: VideoTranscript[];
    if (existingIndex !== -1) {
      // Update existing transcript
      updatedTranscripts = [...currentTranscripts];
      updatedTranscripts[existingIndex] = transcript;
    } else {
      // Add new transcript
      updatedTranscripts = [...currentTranscripts, transcript];
    }
    
    videoTranscriptsStore.transcripts.set(updatedTranscripts);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS, JSON.stringify(updatedTranscripts));
      
      // Sync to Supabase
      await syncOperations.uploadVideoTranscript(transcript);
    } catch (error) {
      console.error('Error saving video transcript:', error);
    }
  },

  updateTranscript: async (itemId: string, updates: Partial<VideoTranscript>) => {
    const currentTranscripts = videoTranscriptsStore.transcripts.get();
    const updatedTranscripts = currentTranscripts.map(t =>
      t.item_id === itemId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    );
    
    videoTranscriptsStore.transcripts.set(updatedTranscripts);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS, JSON.stringify(updatedTranscripts));
      
      // Find the updated transcript and sync
      const updatedTranscript = updatedTranscripts.find(t => t.item_id === itemId);
      if (updatedTranscript) {
        await syncOperations.uploadVideoTranscript(updatedTranscript);
      }
    } catch (error) {
      console.error('Error updating video transcript:', error);
    }
  },

  removeTranscript: async (itemId: string) => {
    const currentTranscripts = videoTranscriptsStore.transcripts.get();
    const filteredTranscripts = currentTranscripts.filter(t => t.item_id !== itemId);
    
    videoTranscriptsStore.transcripts.set(filteredTranscripts);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS, JSON.stringify(filteredTranscripts));
      
      // Sync deletion to Supabase
      await syncOperations.deleteVideoTranscript(itemId);
    } catch (error) {
      console.error('Error removing video transcript:', error);
    }
  },

  loadTranscripts: async () => {
    try {
      videoTranscriptsStore.isLoading.set(true);
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS);
      if (saved) {
        const transcripts = JSON.parse(saved) as VideoTranscript[];
        videoTranscriptsStore.transcripts.set(transcripts);
        console.log('📝 Loaded', transcripts.length, 'video transcripts from storage');
      }
    } catch (error) {
      console.error('Error loading video transcripts:', error);
    } finally {
      videoTranscriptsStore.isLoading.set(false);
    }
  },

  reset: () => {
    videoTranscriptsStore.set(initialState);
  },
  
  clearAll: async () => {
    videoTranscriptsStore.transcripts.set([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.VIDEO_TRANSCRIPTS);
      console.log('📝 Cleared all video transcripts');
    } catch (error) {
      console.error('Error clearing video transcripts:', error);
    }
  },

  setGenerating: (itemId: string, isGenerating: boolean) => {
    const current = videoTranscriptsStore.generatingForItems.get();
    if (isGenerating && !current.includes(itemId)) {
      videoTranscriptsStore.generatingForItems.set([...current, itemId]);
    } else if (!isGenerating) {
      videoTranscriptsStore.generatingForItems.set(current.filter(id => id !== itemId));
    }
  },
};

// Load transcripts on app start
videoTranscriptsActions.loadTranscripts();