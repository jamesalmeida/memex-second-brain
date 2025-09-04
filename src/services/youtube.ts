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

import {MMKV} from 'react-native-mmkv';
// @ts-expect-error to avoid typings' fuss
global.mmkvStorage = MMKV as any;

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
    innertubeInstance = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });
  }
  return innertubeInstance;
};

export const extractYouTubeData = async (url: string) => {
  try {
    const youtube = await getInnertubeInstance();
    
    // Extract video ID from URL
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (!videoIdMatch) {
      throw new Error('Invalid YouTube URL');
    }
    
    const videoId = videoIdMatch[1].split('?')[0]; // Remove any query params after the ID
    const info = await youtube.getInfo(videoId);
    
    // Get the best quality thumbnail
    const thumbnail = info.basic_info.thumbnail?.[0]?.url || 
                     info.basic_info.thumbnail?.[info.basic_info.thumbnail.length - 1]?.url;
    
    return {
      title: info.basic_info.title,
      description: info.basic_info.short_description,
      thumbnail,
      author: info.basic_info.author,
      duration: info.basic_info.duration,
      viewCount: info.basic_info.view_count,
      videoId,
    };
  } catch (error) {
    console.error('YouTube extraction error:', error);
    throw error;
  }
};