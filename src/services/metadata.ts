import { ContentType } from '../types';
import { supabase } from './supabase';

// URL pattern matching for content type detection
// NOTE: Amazon URLs are detected as 'product' type, with visual differentiation in the ProductItemCard
const URL_PATTERNS: Record<ContentType, RegExp[]> = {
  bookmark: [/.*/], // Default fallback
  youtube: [
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /youtube\.com\/embed\//,
  ],
  x: [
    /twitter\.com\/.*\/status\//,
    /x\.com\/.*\/status\//,
  ],
  github: [
    /github\.com\/[^\/]+\/[^\/]+/,
  ],
  instagram: [
    /instagram\.com\/p\//,
  ],
  tiktok: [
    /tiktok\.com\/@.*\/video\//,
  ],
  reddit: [
    /reddit\.com\/r\/.*\/comments\//,
  ],
  linkedin: [
    /linkedin\.com\/.*\/posts\//,
  ],
  image: [
    /\.(jpg|jpeg|png|gif|webp|svg)$/i,
  ],
  pdf: [
    /\.pdf$/i,
  ],
  video: [
    /\.(mp4|avi|mov|wmv|flv|webm)$/i,
  ],
  audio: [
    /\.(mp3|wav|aac|ogg|flac)$/i,
  ],
  note: [], // Handled differently
  article: [], // Handled differently
  product: [], // Handled differently (includes Amazon)
  book: [], // Handled differently
  course: [], // Handled differently
  amazon: [], // Amazon URLs are detected as 'product', not a separate type
};

export interface Metadata {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  domain?: string;
  author?: string;
  published_date?: string;
  content_type?: string;
  error?: string;
}

// Detect content type from URL (client-side)
export function detectContentType(url: string): ContentType {
  for (const [contentType, patterns] of Object.entries(URL_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(url))) {
      return contentType as ContentType;
    }
  }

  // Special detection for articles (generic web pages)
  if (url.startsWith('http')) {
    return 'article';
  }

  return 'bookmark';
}

// Extract metadata using Supabase Edge Function
export async function extractBasicMetadata(url: string): Promise<Metadata> {
  try {
    const contentType = detectContentType(url);

    // Call Supabase Edge Function for metadata extraction
    const { data, error } = await supabase.functions.invoke('extract-metadata', {
      body: {
        url,
        contentType,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    return data as Metadata;
  } catch (error) {
    console.error('Error extracting metadata:', error);

    // Fallback to basic client-side extraction
    return extractFallbackMetadata(url);
  }
}

// Fallback client-side metadata extraction
function extractFallbackMetadata(url: string): Metadata {
  try {
    const urlObj = new URL(url);
    return {
      domain: urlObj.hostname,
      title: url, // Fallback to URL as title
      content_type: detectContentType(url),
    };
  } catch (error) {
    console.error('Error in fallback metadata extraction:', error);
    return {
      title: url,
      domain: 'unknown',
      content_type: 'bookmark',
    };
  }
}

// Helper functions (kept for backward compatibility)
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function extractGitHubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
    };
  }
  return null;
}
