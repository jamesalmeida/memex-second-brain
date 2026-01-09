// === START ===  Making Youtube.js work
import 'event-target-polyfill';
import 'web-streams-polyfill';
import 'text-encoding-polyfill';
import 'react-native-url-polyfill/auto';
import {decode, encode} from 'base-64';

if (!global.btoa) {
  global.btoa = encode;
}

if (!global.atob) {
  global.atob = decode;
}

// Ensure fetch is available
if (!global.fetch) {
  console.warn('fetch not available, this might cause issues with YouTube.js');
}

// Use AsyncStorage instead of MMKV for Expo Go compatibility
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create a mock MMKV class that uses AsyncStorage
class MockMMKV {
  constructor() {
    // Constructor doesn't need to do anything
  }
  
  getString(key: string): string | undefined {
    // This needs to be synchronous for MMKV compatibility
    // We'll return undefined and handle async separately
    console.warn('MockMMKV getString called - returning undefined (async not supported in sync call)');
    return undefined;
  }
  
  set(key: string, value: string): void {
    // Fire and forget async operation
    AsyncStorage.setItem(key, value).catch(error => {
      console.error('AsyncStorage set error:', error);
    });
  }
  
  delete(key: string): void {
    // Fire and forget async operation
    AsyncStorage.removeItem(key).catch(error => {
      console.error('AsyncStorage delete error:', error);
    });
  }
  
  contains(key: string): boolean {
    // This needs to be synchronous - we'll return false for simplicity
    console.warn('MockMMKV contains called - returning false (async not supported in sync call)');
    return false;
  }
  
  getAllKeys(): string[] {
    // Return empty array for simplicity
    return [];
  }
}

// @ts-expect-error to avoid typings' fuss
global.mmkvStorage = MockMMKV;

// See https://github.com/nodejs/node/issues/40678#issuecomment-1126944677
class CustomEvent extends Event {
  #detail;

  constructor(type: string, options?: CustomEventInit<any[]>) {
    super(type, options);
    this.#detail = options?.detail ?? null;
  }

  get detail() {
    return this.#detail;
  }
}

global.CustomEvent = CustomEvent as any;

// === END === Making Youtube.js work

import Innertube, {UniversalCache} from 'youtubei.js';

let innertubeInstance: Innertube | null = null;

export const getInnertubeInstance = async (): Promise<Innertube> => {
  if (!innertubeInstance) {
    try {
      console.log('Creating new Innertube instance...');
      // Try without cache first for Expo Go compatibility
      innertubeInstance = await Innertube.create({
        // Disable cache for Expo Go
        cache: undefined,
        generate_session_locally: true,
        fetch: fetch,
      });
      console.log('Innertube instance created successfully');
    } catch (error) {
      console.error('Failed to create Innertube instance:', error);
      throw error;
    }
  }
  return innertubeInstance;
};

// Test function to verify YouTube.js is working
export const testYouTubeJS = async () => {
  try {
    console.log('Testing YouTube.js setup...');
    const youtube = await getInnertubeInstance();
    console.log('✅ YouTube.js initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ YouTube.js initialization failed:', error);
    return false;
  }
};

export const extractYouTubeData = async (url: string) => {
  try {
    console.log('Starting YouTube extraction for URL:', url);
    
    // More comprehensive URL patterns
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];
    
    let videoId = null;
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }
    
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }
    
    console.log('Extracted video ID:', videoId);
    
    const youtube = await getInnertubeInstance();
    console.log('Got Innertube instance');
    
    const info = await youtube.getInfo(videoId);
    console.log('Got video info from YouTube');
    try {
      // Log the raw youtubei.js basic_info payload for debugging
      console.log('🎥 [YouTubeAPI] basic_info:', JSON.stringify(info.basic_info ?? {}, null, 2));
    } catch (e) {
      console.log('🎥 [YouTubeAPI] basic_info not serializable');
    }
    
    // Get the best quality thumbnail
    const thumbnail = info.basic_info.thumbnail?.[0]?.url || 
                     info.basic_info.thumbnail?.[info.basic_info.thumbnail.length - 1]?.url;
    
    // Check if it's a YouTube Short
    const isShort = url.includes('/shorts/') || (info.basic_info.duration && info.basic_info.duration <= 60);
    
    const publishedAt = (info.basic_info as any).publish_date || (info.basic_info as any).upload_date || undefined;

    const channel = (info.basic_info as any).channel || {};
    const category = (info.basic_info as any).category;
    const tags = (info.basic_info as any).tags || undefined;
    const isLive = (info.basic_info as any).is_live ?? false;
    const isLiveContent = (info.basic_info as any).is_live_content ?? false;

    const result = {
      title: info.basic_info.title,
      description: info.basic_info.short_description,
      thumbnail,
      author: info.basic_info.author,
      duration: info.basic_info.duration,
      viewCount: info.basic_info.view_count,
      videoId,
      isShort,
      // include original published time when available
      publishedAt,
      // channel & extra metadata
      channelId: channel.id,
      channelName: channel.name || info.basic_info.author,
      channelUrl: channel.url,
      category,
      tags,
      isLive,
      isLiveContent,
    };
    
    console.log('YouTube extraction successful:', result.title);
    return result;
  } catch (error) {
    console.error('YouTube extraction error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
};

export const getYouTubeTranscript = async (videoId: string): Promise<{ transcript: string; language: string }> => {
  try {
    console.log('Fetching transcript for video ID:', videoId);

    const youtube = await getInnertubeInstance();

    // First try the standard method
    try {
      const info = await youtube.getInfo(videoId);
      const transcriptInfo = await info.getTranscript();

      if (transcriptInfo?.transcript?.content?.body?.initial_segments) {
        const segments = transcriptInfo.transcript.content.body.initial_segments;

        if (segments && segments.length > 0) {
          const fullTranscript = segments
            .filter((segment: any) => segment.snippet)
            .map((segment: any) => {
              if (segment.snippet.toString) {
                return segment.snippet.toString();
              } else if (segment.snippet.text) {
                return segment.snippet.text;
              }
              return '';
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (fullTranscript) {
            const language = transcriptInfo.selectedLanguage || 'en';
            console.log(`Transcript fetched via standard API: ${fullTranscript.length} characters, language: ${language}`);
            return { transcript: fullTranscript, language };
          }
        }
      }
    } catch (standardError) {
      console.log('Standard transcript method failed, trying caption URL workaround:', standardError);
    }

    // Workaround: Use getBasicInfo and fetch caption URLs directly
    // This bypasses YouTube's bot detection on the /get_transcript endpoint
    console.log('Attempting caption URL workaround...');
    const basicInfo = await youtube.getBasicInfo(videoId);

    // Access streaming data which contains caption tracks
    const streamingData = (basicInfo as any).streaming_data;
    const captionTracks = (basicInfo as any).captions?.caption_tracks
      || streamingData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      || [];

    if (!captionTracks || captionTracks.length === 0) {
      throw new Error('No caption tracks available for this video');
    }

    // Find the best caption track (prefer English, then any available)
    let selectedTrack = captionTracks.find((track: any) =>
      track.languageCode === 'en' || track.language_code === 'en'
    );
    if (!selectedTrack) {
      selectedTrack = captionTracks[0];
    }

    const captionUrl = selectedTrack.baseUrl || selectedTrack.base_url;
    if (!captionUrl) {
      throw new Error('No caption URL found in track');
    }

    console.log('Fetching captions from URL:', captionUrl);

    // Fetch the timedtext XML directly
    const response = await fetch(captionUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch captions: ${response.status}`);
    }

    const xmlText = await response.text();

    // Parse the XML to extract transcript text
    // The format is: <transcript><text start="0" dur="5.2">Caption text</text>...</transcript>
    const textMatches = xmlText.match(/<text[^>]*>([^<]*)<\/text>/g);

    if (!textMatches || textMatches.length === 0) {
      throw new Error('No caption text found in response');
    }

    const fullTranscript = textMatches
      .map(match => {
        // Extract text content and decode HTML entities
        const textContent = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
        return decodeHTMLEntities(textContent);
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullTranscript) {
      throw new Error('Transcript is empty');
    }

    const language = selectedTrack.languageCode || selectedTrack.language_code || 'en';
    console.log(`Transcript fetched via caption URL: ${fullTranscript.length} characters, language: ${language}`);

    return {
      transcript: fullTranscript,
      language,
    };
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    throw error;
  }
};

// Helper function to decode HTML entities in caption text
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}