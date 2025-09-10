// Core data types based on Supabase schema from PRD

export type ContentType =
  | 'bookmark'
  | 'youtube'
  | 'youtube_short'
  | 'x'
  | 'github'
  | 'instagram'
  | 'tiktok'
  | 'reddit'
  | 'amazon'
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
  | 'course';

export interface User {
  id: string;
  email: string;
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
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  // Removed: video_url, image_urls, space_ids
  // These are now in separate tables
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
}

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
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface ItemChat {
  id: string;
  item_id: string;
  user_id: string;
  created_at: string;
}

export interface SpaceChat {
  id: string;
  space_id: string;
  user_id: string;
  created_at: string;
}

export type ChatType = 'item' | 'space';

export interface ChatMessage {
  id: string;
  chat_id: string;
  chat_type: ChatType;
  role: 'user' | 'system' | 'assistant';
  content: string;
  created_at: string;
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
