// Reddit API service for extracting post metadata
// Uses Reddit's public JSON API (no authentication required)

export interface RedditPostData {
  title: string;
  selftext?: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  thumbnail?: string;
  images?: string[];
  videoUrl?: string;
  created_utc: number;
  ups: number;
  num_comments: number;
  upvote_ratio: number;
  post_hint?: string;
  is_gallery?: boolean;
  is_video?: boolean;
  // Flair
  link_flair_text?: string;
  link_flair_background_color?: string;
  link_flair_text_color?: string;
  // Video metadata
  video_duration?: number; // in seconds
  // Post status flags
  spoiler: boolean;
  over_18: boolean;
  locked: boolean;
  stickied: boolean;
  // Engagement
  total_awards_received: number;
  num_crossposts: number;
}

interface RedditAPIResponse {
  data: {
    children: Array<{
      data: any;
    }>;
  };
}

/**
 * Decode HTML entities in Reddit text
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[a-z]+;|&#\d+;/gi, (match) => entities[match] || match);
}

/**
 * Extract images from Reddit post data
 */
function extractImages(postData: any): string[] {
  const images: string[] = [];

  // Handle gallery posts
  if (postData.is_gallery && postData.gallery_data && postData.media_metadata) {
    const galleryItems = postData.gallery_data.items || [];
    for (const item of galleryItems) {
      const mediaId = item.media_id;
      const mediaItem = postData.media_metadata[mediaId];

      if (mediaItem && mediaItem.s) {
        // Get the highest quality image
        const imageUrl = mediaItem.s.u || mediaItem.s.gif;
        if (imageUrl) {
          // Decode HTML entities in URL
          images.push(decodeHTMLEntities(imageUrl));
        }
      }
    }
  }
  // Handle single image posts
  else if (postData.preview && postData.preview.images && postData.preview.images.length > 0) {
    const preview = postData.preview.images[0];
    if (preview.source && preview.source.url) {
      images.push(decodeHTMLEntities(preview.source.url));
    }
  }
  // Handle direct image URLs
  else if (postData.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(postData.url)) {
    images.push(postData.url);
  }

  return images;
}

/**
 * Extract video URL from Reddit post data
 */
function extractVideoUrl(postData: any): string | undefined {
  // Check for Reddit-hosted video
  if (postData.is_video && postData.secure_media && postData.secure_media.reddit_video) {
    return postData.secure_media.reddit_video.fallback_url;
  }

  // Check for crossposted video
  if (postData.crosspost_parent_list && postData.crosspost_parent_list.length > 0) {
    const crosspost = postData.crosspost_parent_list[0];
    if (crosspost.is_video && crosspost.secure_media && crosspost.secure_media.reddit_video) {
      return crosspost.secure_media.reddit_video.fallback_url;
    }
  }

  // Check for external video links
  if (postData.post_hint === 'hosted:video' && postData.url) {
    return postData.url;
  }

  return undefined;
}

/**
 * Fetch Reddit post data using the public JSON API
 *
 * @param url - The Reddit post URL (e.g., https://reddit.com/r/pics/comments/abc123/title)
 * @returns Structured Reddit post data or null if fetch fails
 */
export async function fetchRedditPostData(url: string): Promise<RedditPostData | null> {
  try {
    let finalUrl = url;

    // Check if this is a Reddit share link (/s/ format)
    // These need to be resolved to the actual post URL first
    if (url.includes('/s/')) {
      console.log('Detected Reddit share link, resolving to full URL...');

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'MemexSecondBrain/1.0',
          },
        });

        // Get the final URL after redirects
        finalUrl = response.url;
        console.log('Resolved share link to:', finalUrl);
      } catch (redirectError) {
        console.error('Failed to resolve share link:', redirectError);
        // Try with GET request as fallback
        try {
          const response = await fetch(url, {
            redirect: 'follow',
            headers: {
              'User-Agent': 'MemexSecondBrain/1.0',
            },
          });
          finalUrl = response.url;
          console.log('Resolved share link to (via GET):', finalUrl);
        } catch (getError) {
          console.error('Failed to resolve share link with GET:', getError);
          return null;
        }
      }
    }

    // Parse the URL to properly construct JSON endpoint
    console.log('[Reddit] Raw resolved URL:', finalUrl);

    const urlObj = new URL(finalUrl);
    console.log('[Reddit] URL pathname:', urlObj.pathname);
    console.log('[Reddit] URL search params:', urlObj.search);

    // Construct JSON API URL by appending .json to the pathname (not to query params)
    let jsonPath = urlObj.pathname;
    if (jsonPath.endsWith('/')) {
      jsonPath = jsonPath.slice(0, -1);
    }
    jsonPath += '.json';

    // Build the final JSON URL with the clean path (without tracking params)
    const jsonUrl = `${urlObj.protocol}//${urlObj.host}${jsonPath}`;

    console.log('[Reddit] Constructed JSON URL:', jsonUrl);

    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'MemexSecondBrain/1.0',
        'Accept': 'application/json',
      },
    });

    console.log('[Reddit] Response status:', response.status);
    console.log('[Reddit] Response content-type:', response.headers.get('content-type'));

    if (!response.ok) {
      console.error('[Reddit] API error:', response.status, response.statusText);
      return null;
    }

    // Check if response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const textPreview = await response.text();
      console.error('[Reddit] Expected JSON but got:', contentType);
      console.error('[Reddit] Response preview:', textPreview.slice(0, 200));
      return null;
    }

    const data: RedditAPIResponse[] = await response.json();

    // console.log('[Reddit] Full JSON response:', JSON.stringify(data, null, 2));

    // Reddit returns an array with 2 elements: [post, comments]
    // We only need the post data from the first element
    if (!data || !data[0] || !data[0].data || !data[0].data.children || !data[0].data.children[0]) {
      console.error('[Reddit] Invalid API response structure');
      console.error('[Reddit] Response data:', JSON.stringify(data, null, 2));
      return null;
    }

    const postData = data[0].data.children[0].data;

    console.log('[Reddit] Post data fetched successfully:', {
      title: postData.title,
      subreddit: postData.subreddit,
      author: postData.author,
      is_gallery: postData.is_gallery,
      is_video: postData.is_video,
      post_hint: postData.post_hint,
      has_preview: !!postData.preview,
      has_media_metadata: !!postData.media_metadata,
      has_gallery_data: !!postData.gallery_data,
    });

    // Extract images
    const images = extractImages(postData);

    // Extract video URL
    const videoUrl = extractVideoUrl(postData);

    // Extract video duration (if video)
    let videoDuration: number | undefined;
    if (postData.is_video && postData.media?.reddit_video?.duration) {
      videoDuration = postData.media.reddit_video.duration;
    }

    // Extract thumbnail (if not a placeholder)
    let thumbnail: string | undefined;
    if (postData.thumbnail &&
        postData.thumbnail !== 'self' &&
        postData.thumbnail !== 'default' &&
        postData.thumbnail !== 'nsfw' &&
        postData.thumbnail.startsWith('http')) {
      thumbnail = postData.thumbnail;
    } else if (images.length > 0) {
      thumbnail = images[0];
    }

    // Construct the Reddit post data
    const redditData: RedditPostData = {
      title: postData.title || 'Reddit Post',
      selftext: postData.selftext || undefined,
      author: postData.author || 'unknown',
      subreddit: postData.subreddit || 'unknown',
      url: postData.url || url,
      permalink: `https://reddit.com${postData.permalink}`,
      thumbnail,
      images: images.length > 0 ? images : undefined,
      videoUrl,
      created_utc: postData.created_utc || 0,
      ups: postData.ups || 0,
      num_comments: postData.num_comments || 0,
      upvote_ratio: postData.upvote_ratio || 0,
      post_hint: postData.post_hint,
      is_gallery: postData.is_gallery || false,
      is_video: postData.is_video || false,
      // Flair
      link_flair_text: postData.link_flair_text || undefined,
      link_flair_background_color: postData.link_flair_background_color || undefined,
      link_flair_text_color: postData.link_flair_text_color || undefined,
      // Video metadata
      video_duration: videoDuration,
      // Post status flags
      spoiler: postData.spoiler || false,
      over_18: postData.over_18 || false,
      locked: postData.locked || false,
      stickied: postData.stickied || false,
      // Engagement
      total_awards_received: postData.total_awards_received || 0,
      num_crossposts: postData.num_crossposts || 0,
    };

    console.log('Extracted Reddit data:', {
      title: redditData.title,
      hasImages: !!redditData.images,
      imageCount: redditData.images?.length || 0,
      hasVideo: !!redditData.videoUrl,
      hasSelftext: !!redditData.selftext,
    });

    return redditData;
  } catch (error) {
    console.error('Error fetching Reddit post data:', error);
    return null;
  }
}
