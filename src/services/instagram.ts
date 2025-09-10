import { API_CONFIG, isAPIConfigured } from '../config/api';

export interface InstagramMetadata {
  id: string;
  url: string;
  caption?: string;
  author?: {
    username?: string;
    name?: string;
  };
  media?: Array<{
    type: 'photo' | 'video';
    url: string;
  }>;
  embedHtml?: string;
  width?: number;
  height?: number;
}

// Extract Instagram post ID from various URL formats
export const extractInstagramPostId = (url: string): string | null => {
  // Handle various Instagram URL formats:
  // https://www.instagram.com/p/ABC123/
  // https://www.instagram.com/reel/ABC123/
  // https://www.instagram.com/tv/ABC123/
  // https://instagram.com/p/ABC123/?igshid=xyz
  const patterns = [
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/i,
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/i,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

// Parse Instagram oEmbed HTML response to extract metadata
const parseInstagramEmbedHtml = (html: string): {
  caption?: string;
  username?: string;
  imageUrl?: string;
} => {
  const metadata: {
    caption?: string;
    username?: string;
    imageUrl?: string;
  } = {};

  try {
    // Extract caption from blockquote content
    // Instagram embeds typically have the caption in the blockquote
    const captionMatch = html.match(/<blockquote[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (captionMatch && captionMatch[1]) {
      // Clean up HTML entities and tags
      metadata.caption = captionMatch[1]
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .trim();
    }

    // Extract username from the permalink in the HTML
    const usernameMatch = html.match(/instagram\.com\/([^\/]+)\/(?:p|reel|tv)\//i);
    if (usernameMatch && usernameMatch[1]) {
      metadata.username = usernameMatch[1];
    }

    // Try to extract image URL from data attributes or img tags
    // Instagram might include preview images in the embed
    const imageMatch = html.match(/data-instgrm-permalink="([^"]+)"/i);
    if (imageMatch && imageMatch[1]) {
      // We can use the permalink to construct a potential image URL
      // Note: Direct image extraction from embed HTML is limited
      metadata.imageUrl = imageMatch[1];
    }
  } catch (error) {
    console.error('Error parsing Instagram embed HTML:', error);
  }

  return metadata;
};

// Fetch Instagram data using Meta's oEmbed API
export const fetchInstagramData = async (url: string): Promise<InstagramMetadata> => {
  if (!isAPIConfigured.instagram()) {
    throw new Error('Instagram API is not configured');
  }

  const postId = extractInstagramPostId(url);
  if (!postId) {
    throw new Error('Invalid Instagram URL - could not extract post ID');
  }

  try {
    // Use Meta's oEmbed endpoint
    const oembedUrl = `${API_CONFIG.INSTAGRAM.BASE_URL}/instagram_oembed`;
    const params = new URLSearchParams({
      url: url,
      access_token: API_CONFIG.INSTAGRAM.ACCESS_TOKEN,
      omitscript: 'true', // Omit the JavaScript for cleaner HTML
    });

    console.log('Fetching Instagram oEmbed data for:', url);
    const response = await fetch(`${oembedUrl}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Instagram oEmbed API error:', response.status, errorText);
      throw new Error(`Instagram API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Instagram oEmbed response:', data);

    // Parse the HTML to extract additional metadata
    const parsedMetadata = parseInstagramEmbedHtml(data.html || '');

    // Determine media type from the URL
    const mediaType = url.includes('/reel/') || url.includes('/tv/') ? 'video' : 'photo';

    return {
      id: postId,
      url: url,
      caption: parsedMetadata.caption,
      author: {
        username: parsedMetadata.username,
      },
      media: [{
        type: mediaType,
        url: url, // We'll use the post URL since direct media URLs aren't available
      }],
      embedHtml: data.html,
      width: data.width,
      height: data.height,
    };
  } catch (error) {
    console.error('Error fetching Instagram data:', error);
    throw error;
  }
};

// Format Instagram date to readable format (if we had timestamp data)
export const formatInstagramDate = (dateString: string): string => {
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