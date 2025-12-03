import { ContentType } from '../types';

// Content type configurations
export const CONTENT_TYPES: Record<ContentType, { label: string; icon: string }> = {
  bookmark: { label: 'Bookmark', icon: 'link' },
  youtube: { label: 'YouTube', icon: 'video-library' },
  youtube_short: { label: 'YouTube Short', icon: 'movie' },
  x: { label: 'X/Twitter', icon: 'chat' },
  github: { label: 'GitHub', icon: 'code' },
  instagram: { label: 'Instagram', icon: 'photo-camera' },
  facebook: { label: 'Facebook', icon: 'thumb-up' },
  threads: { label: 'Threads', icon: 'alternate-email' },
  tiktok: { label: 'TikTok', icon: 'music-video' },
  reddit: { label: 'Reddit', icon: 'forum' },
  amazon: { label: 'Amazon', icon: 'shopping-cart' },
  linkedin: { label: 'LinkedIn', icon: 'business' },
  image: { label: 'Image', icon: 'image' },
  pdf: { label: 'PDF', icon: 'picture-as-pdf' },
  video: { label: 'Video', icon: 'videocam' },
  audio: { label: 'Audio', icon: 'audiotrack' },
  podcast: { label: 'Podcast', icon: 'podcasts' },
  note: { label: 'Note', icon: 'note' },
  article: { label: 'Article', icon: 'article' },
  product: { label: 'Product', icon: 'shopping-bag' },
  book: { label: 'Book', icon: 'book' },
  course: { label: 'Course', icon: 'school' },
  movie: { label: 'Movie', icon: 'movie' },
  tv_show: { label: 'TV Show', icon: 'tv' },
};

// UI Constants
export const UI = {
  ITEM_GRID_COLUMNS: 2,
  ITEMS_PER_PAGE: 20,
  SEARCH_DEBOUNCE_MS: 300,
  ANIMATION_DURATION: 300,
  BORDER_RADIUS: 8,
  SPACING: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

// Colors
export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  background: {
    light: '#FFFFFF',
    dark: '#000000',
  },
  text: {
    primary: '#333333',
    light: '#333333',
    dark: '#FFFFFF',
  },
  border: {
    light: '#E5E5EA',
    dark: '#38383A',
  },
};

// Supabase configuration
export const SUPABASE = {
  URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
};

// Debug: Log environment variables (remove in production)
console.log('🔍 SUPABASE URL:', SUPABASE.URL ? '✅ Set' : '❌ Empty');
console.log('🔍 SUPABASE KEY:', SUPABASE.ANON_KEY ? '✅ Set' : '❌ Empty');

// App configuration
export const APP = {
  NAME: 'Memex: Second Brain',
  VERSION: '0.1.0',
  BUNDLE_ID: 'com.jamesalmeida.memex',
};

// External API services (client-side)
export const API = {
  OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
  // Note: Most API functionality will be handled directly via Supabase
  // or client-side external API calls
};

// Storage keys
export const STORAGE_KEYS = {
  USER_SESSION: 'user_session',
  THEME: 'theme',
  LAST_SYNC: 'last_sync',
  OFFLINE_QUEUE: 'offline_queue',
  ITEMS: 'items',
  ITEM_SPACES: 'item_spaces',
  ITEM_METADATA: 'item_metadata',
  ITEM_TYPE_METADATA: 'item_type_metadata',
  SPACES: 'spaces',
  VIDEO_TRANSCRIPTS: '@memex_video_transcripts',
  IMAGE_DESCRIPTIONS: '@memex_image_descriptions',
  SYNC_STATUS: 'sync_status',
  AI_SETTINGS: '@memex_ai_settings',
  AI_MODELS: '@memex_ai_models',
  ITEM_CHATS: '@memex_item_chats',
  CHAT_MESSAGES: '@memex_chat_messages',
  FILTERS: '@memex_filters',
  USER_SETTINGS: '@memex_user_settings', // Cloud-synced user settings
  ADMIN_SETTINGS: '@memex_admin_settings', // Cloud-synced global admin settings
  PENDING_ITEMS: '@memex_pending_items', // Shared items being processed
  ASSISTANT_CONVERSATIONS: '@memex_assistant_conversations', // Assistant chat conversations
};

// Special spaces
export const SPECIAL_SPACES = {
  ARCHIVE_ID: '__archive__',
};

// Share extension
export const SHARE_EXTENSION = {
  GROUP_IDENTIFIER: 'group.com.jamesalmeida.memex',
  MAX_ITEMS: 10,
};
