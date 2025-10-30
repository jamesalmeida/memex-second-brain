import { observable } from '@legendapp/state';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'admin_prefs_v1';

interface AdminPrefsState {
  youtubeSource: 'youtubei' | 'serpapi';
}

const initialState: AdminPrefsState = {
  youtubeSource: 'youtubei',
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
      }
    } catch {}
  },
  save: async () => {
    try {
      const data = { youtubeSource: adminPrefsStore.youtubeSource.get() };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  },
  setYouTubeSource: async (src: 'youtubei' | 'serpapi') => {
    adminPrefsStore.youtubeSource.set(src);
    await adminPrefsActions.save();
  },
};

// Auto-load on import
adminPrefsActions.load();


