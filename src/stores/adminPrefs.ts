import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'admin_prefs_v1';

interface AdminPrefsState {
  youtubeSource: 'youtubei' | 'serpapi';
  youtubeTranscriptSource: 'youtubei' | 'serpapi';
  autoGenerateTldr: boolean;
}

const initialState: AdminPrefsState = {
  youtubeSource: 'youtubei',
  youtubeTranscriptSource: 'youtubei',
  autoGenerateTldr: false,
};

export const adminPrefsStore = observable<AdminPrefsState>(initialState);

export const adminPrefsActions = {
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.youtubeSource === 'youtubei' || parsed.youtubeSource === 'serpapi') {
          adminPrefsStore.youtubeSource.set(parsed.youtubeSource);
        }
        if (parsed.youtubeTranscriptSource === 'youtubei' || parsed.youtubeTranscriptSource === 'serpapi') {
          adminPrefsStore.youtubeTranscriptSource.set(parsed.youtubeTranscriptSource);
        }
        if (typeof parsed.autoGenerateTldr === 'boolean') {
          adminPrefsStore.autoGenerateTldr.set(parsed.autoGenerateTldr);
        }
      }
    } catch {}
  },
  save: async () => {
    try {
      const data = {
        youtubeSource: adminPrefsStore.youtubeSource.get(),
        youtubeTranscriptSource: adminPrefsStore.youtubeTranscriptSource.get(),
        autoGenerateTldr: adminPrefsStore.autoGenerateTldr.get(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  },
  setYouTubeSource: async (src: 'youtubei' | 'serpapi') => {
    adminPrefsStore.youtubeSource.set(src);
    await adminPrefsActions.save();
  },
  setYouTubeTranscriptSource: async (src: 'youtubei' | 'serpapi') => {
    adminPrefsStore.youtubeTranscriptSource.set(src);
    await adminPrefsActions.save();
  },
  setAutoGenerateTldr: async (enabled: boolean) => {
    adminPrefsStore.autoGenerateTldr.set(enabled);
    await adminPrefsActions.save();
  },
};

// Auto-load on import
adminPrefsActions.load();


