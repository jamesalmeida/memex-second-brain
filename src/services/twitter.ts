import { API_CONFIG, isAPIConfigured } from '../config/api';

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
  }>;
  quotedTweet?: {
    text: string;
    author: string;
  };
}

// Extract tweet ID from various Twitter/X URL formats
export const extractTweetId = (url: string): string | null => {
  // Handle various Twitter/X URL formats:
  // https://twitter.com/user/status/1234567890
  // https://x.com/user/status/1234567890
  // https://twitter.com/user/status/1234567890?s=20
  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i,
    /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

// Fetch tweet data using Twitter API v2
export const fetchTweetData = async (tweetId: string): Promise<TwitterMetadata> => {
  if (!isAPIConfigured.twitter()) {
    throw new Error('Twitter API is not configured');
  }

  const params = new URLSearchParams({
    'tweet.fields': 'created_at,author_id,public_metrics,referenced_tweets,attachments',
    'user.fields': 'name,username,profile_image_url',
    'media.fields': 'url,preview_image_url,type,duration_ms,height,width',
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
    
    // Extract main tweet data
    const tweet = data.data;
    const author = data.includes?.users?.find((u: any) => u.id === tweet.author_id);
    const media = data.includes?.media;

    // Process media attachments
    let processedMedia: TwitterMetadata['media'] = undefined;
    if (media && media.length > 0) {
      processedMedia = media.map((m: any) => ({
        type: m.type,
        url: m.url || m.preview_image_url,
        previewUrl: m.preview_image_url,
      }));
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