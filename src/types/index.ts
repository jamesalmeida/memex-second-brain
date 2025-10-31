// Core data types based on Supabase schema from PRD

export type ContentType =
  | 'bookmark'
  | 'youtube'
  | 'youtube_short'
  | 'x'
  | 'github'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'tiktok'
  | 'reddit'
  | 'amazon'
  | 'ebay'
  | 'yelp'
  | 'app_store'
  | 'linkedin'
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'podcast'
  | 'note'
  | 'article'
  | 'product'
  | 'book'
  | 'course'
  | 'movie'
  | 'tv_show';

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    [key: string]: any;
  };
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  url?: string;
  content_type: ContentType;
  content?: string;
  desc?: string;
  thumbnail_url?: string;
  raw_text?: string;
  tags?: string[];
  tldr?: string; // AI-generated summary of item content
  notes?: string; // User's personal notes and annotations
  created_at: string;
  updated_at: string;
  space_id?: string | null; // Single space per item (replaces item_spaces many-to-many)
  is_archived: boolean;
  archived_at?: string | null;
  auto_archived?: boolean; // True if archived automatically when space was archived
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface ItemMetadata {
  item_id: string;
  domain?: string;
  author?: string;
  username?: string;
  profile_image?: string;
  published_date?: string;
}

export interface ItemTypeMetadata {
  item_id: string;
  content_type: ContentType;
  data: {
    video_url?: string;
    image_urls?: string[];
    [key: string]: any;
  };
}

export interface Space {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  desc?: string; // Kept for backward compatibility
  color: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;
  item_count?: number;
  order_index?: number;
  is_archived?: boolean;
  archived_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

/**
 * @deprecated Use Item.space_id instead. Items now have a single space_id field.
 * This interface is kept for backwards compatibility during migration.
 */
export interface ItemSpace {
  item_id: string;
  space_id: string;
  created_at: string;
}

export type VideoPlatform = 'youtube' | 'x' | 'tiktok' | 'instagram' | 'reddit';

export interface VideoTranscript {
  id: string;
  item_id: string;
  transcript: string;
  platform: VideoPlatform;
  language: string;
  duration?: number;
  segments?: Array<{ startMs: number; endMs?: number; text: string }>; // For timestamped transcripts (SerpAPI)
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface ImageDescription {
  id: string;
  item_id: string;
  image_url: string;
  description: string;
  model: string;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface ItemChat {
  id: string;
  item_id: string;
  user_id: string;
  created_at: string;
  title?: string;
  updated_at?: string;
}

export interface SpaceChat {
  id: string;
  space_id: string;
  user_id: string;
  created_at: string;
  title?: string;
  updated_at?: string;
}

export type ChatType = 'item' | 'space';

export interface ChatMessageMetadata {
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  timestamp?: string;
  context_version?: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  chat_type: ChatType;
  role: 'user' | 'system' | 'assistant';
  content: string;
  created_at: string;
  metadata?: ChatMessageMetadata;
}

export type ActionType =
  | 'create_item'
  | 'update_item'
  | 'delete_item'
  | 'create_capture'
  | 'save_video_transcript'
  | 'delete_video_transcript'
  | 'add_item_to_space'
  | 'remove_item_from_space';

export type QueueStatus = 'pending' | 'synced' | 'failed';

export interface OfflineQueue {
  id: string;
  user_id: string;
  action_type: ActionType;
  payload: Record<string, any>;
  created_at: string;
  status: QueueStatus;
}

// UI-specific types
export interface ItemCardProps {
  item: Item;
  onPress: (item: Item) => void;
  onLongPress?: (item: Item) => void;
}

export interface SpaceCardProps {
  space: Space;
  itemCount: number;
  onPress: (space: Space) => void;
}

export interface SearchFilters {
  contentType?: ContentType;
  spaceId?: string;
  isArchived?: boolean;
}

export type RadialActionId = 'chat' | 'share' | 'archive' | 'unarchive' | 'delete' | 'move' | 'refresh';

export interface UserSettings {
  id: string;
  user_id: string;
  // Theme settings
  theme_dark_mode: boolean;
  // AI settings
  ai_chat_model: string;
  ai_metadata_model: string;
  // Note: ai_auto_transcripts and ai_auto_image_descriptions moved to admin_settings table (global settings)
  // UI preferences
  ui_x_video_muted: boolean;
  ui_autoplay_x_videos: boolean;
  ui_radial_actions?: RadialActionId[]; // 3 action buttons for radial menu
  // Admin settings
  is_admin?: boolean; // Admin flag - only admins can access admin panel
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Global admin settings that apply to ALL users
// Only one row exists in the database
export interface AdminSettings {
  id: string;
  // AI Automation Settings
  auto_generate_transcripts: boolean;
  auto_generate_image_descriptions: boolean;
  auto_generate_tldr: boolean;
  // API Source Preferences
  youtube_source: 'youtubei' | 'serpapi';
  youtube_transcript_source: 'youtubei' | 'serpapi';
  // Timestamps
  created_at: string;
  updated_at: string;
}
