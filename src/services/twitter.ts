import { API_CONFIG, isAPIConfigured } from '../config/api';
import { extractTweetId as extractTweetIdFromUrl } from '../utils/urlHelpers';

export interface TwitterMetadata {
  id: string;
  text: string;
  author: {
    name: string;
    username: string;
    profileImage?: string;
  };
  createdAt: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    views?: number;
  };
  media?: Array<{
    type: 'photo' | 'video' | 'animated_gif';
    url: string;
    previewUrl?: string;
    variants?: Array<{
      bit_rate?: number;
      content_type: string;
      url: string;
    }>;
  }>;
  quotedTweet?: {
    text: string;
    author: string;
  };
}

// Extract tweet ID from various Twitter/X URL formats
export const extractTweetId = extractTweetIdFromUrl;

// Fetch tweet data using Twitter API v2
export const fetchTweetData = async (tweetId: string): Promise<TwitterMetadata> => {
  if (!isAPIConfigured.twitter()) {
    throw new Error('Twitter API is not configured');
  }

  const params = new URLSearchParams({
    'tweet.fields': 'created_at,author_id,public_metrics,referenced_tweets,attachments',
    'user.fields': 'name,username,profile_image_url',
    'media.fields': 'url,preview_image_url,type,duration_ms,height,width,variants',
    'expansions': 'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id',
  });

  try {
    const response = await fetch(
      `${API_CONFIG.TWITTER.BASE_URL}/tweets/${tweetId}?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${API_CONFIG.TWITTER.BEARER_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter API error:', response.status, errorText);
      throw new Error(`Twitter API error: ${response.status}`);
    }

    const data = await response.json();
    try {
      // Log the raw Twitter/X API payload for debugging saves
      console.log('🐦 [TwitterAPI] Raw response:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('🐦 [TwitterAPI] Raw response (non-serializable)');
    }
    
    // Extract main tweet data
    const tweet = data.data;
    const author = data.includes?.users?.find((u: any) => u.id === tweet.author_id);
    const media = data.includes?.media;

    // Process media attachments
    let processedMedia: TwitterMetadata['media'] = undefined;
    if (media && media.length > 0) {
      processedMedia = media.map((m: any) => {
        // For videos, get the best quality variant
        let videoUrl = m.url || m.preview_image_url;
        if (m.type === 'video' || m.type === 'animated_gif') {
          if (m.variants && m.variants.length > 0) {
            // Filter for mp4 variants and sort by bitrate
            const mp4Variants = m.variants
              .filter((v: any) => v.content_type === 'video/mp4')
              .sort((a: any, b: any) => (b.bit_rate || 0) - (a.bit_rate || 0));
            
            if (mp4Variants.length > 0) {
              videoUrl = mp4Variants[0].url;
            }
          }
        }
        
        return {
          type: m.type,
          url: videoUrl,
          previewUrl: m.preview_image_url,
          variants: m.variants,
        };
      });
    }

    // Check for quoted tweets
    let quotedTweet: TwitterMetadata['quotedTweet'] = undefined;
    if (tweet.referenced_tweets) {
      const quoted = tweet.referenced_tweets.find((rt: any) => rt.type === 'quoted');
      if (quoted && data.includes?.tweets) {
        const quotedTweetData = data.includes.tweets.find((t: any) => t.id === quoted.id);
        if (quotedTweetData) {
          const quotedAuthor = data.includes.users?.find((u: any) => u.id === quotedTweetData.author_id);
          quotedTweet = {
            text: quotedTweetData.text,
            author: quotedAuthor ? `@${quotedAuthor.username}` : 'Unknown',
          };
        }
      }
    }

    return {
      id: tweet.id,
      text: tweet.text,
      author: {
        name: author?.name || 'Unknown',
        username: author?.username || 'unknown',
        profileImage: author?.profile_image_url,
      },
      createdAt: tweet.created_at,
      metrics: {
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        views: tweet.public_metrics?.impression_count,
      },
      media: processedMedia,
      quotedTweet,
    };
  } catch (error) {
    console.error('Error fetching tweet data:', error);
    throw error;
  }
};

// Format tweet date to readable format
export const formatTweetDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffHours < 24 * 7) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

// Get the video URL from Twitter metadata
export const getVideoUrlFromMetadata = (metadata: TwitterMetadata): string | null => {
  if (!metadata.media || metadata.media.length === 0) {
    return null;
  }

  // Find the first video or animated_gif
  const videoMedia = metadata.media.find(
    m => m.type === 'video' || m.type === 'animated_gif'
  );

  if (!videoMedia) {
    return null;
  }

  // Return the highest quality video URL
  if (videoMedia.variants && videoMedia.variants.length > 0) {
    const mp4Variants = videoMedia.variants
      .filter(v => v.content_type === 'video/mp4')
      .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));

    if (mp4Variants.length > 0) {
      return mp4Variants[0].url;
    }
  }

  return videoMedia.url || null;
};

// Get transcript for X video using AssemblyAI
export const getXVideoTranscript = async (
  videoUrl: string,
  onProgress?: (status: string) => void
): Promise<{ transcript: string; language: string }> => {
  const { transcribeVideo } = await import('./assemblyai');

  try {
    console.log('Fetching transcript for X video:', videoUrl);

    const result = await transcribeVideo(videoUrl, onProgress);

    console.log(`X video transcript fetched successfully: ${result.transcript.length} characters, language: ${result.language}`);

    return result;
  } catch (error) {
    console.error('Error fetching X video transcript:', error);
    throw error;
  }
};
