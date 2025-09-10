import OpenAI from 'openai';
import { API_CONFIG, isAPIConfigured } from '../config/api';
import { extractYouTubeData } from './youtube';
import { extractTweetId, fetchTweetData, formatTweetDate } from './twitter';
import { extractInstagramPostId, fetchInstagramData } from './instagram';

export interface URLMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  images?: string[]; // For multiple images
  videoUrl?: string; // Add video URL for Twitter/X videos
  siteName?: string;
  favicon?: string;
  contentType: string;
  author?: string;
  publishedDate?: string;
  duration?: string; // For videos
  tags?: string[];
  error?: string;
}

// Detect URL type
export const detectURLType = (url: string): string => {
  const lowerUrl = url.toLowerCase();
  
  // YouTube detection
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  // Twitter/X detection  
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'x';
  }
  // Instagram detection
  if (lowerUrl.includes('instagram.com')) {
    return 'instagram';
  }
  // TikTok detection
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) {
    return 'tiktok';
  }
  // Reddit detection
  if (lowerUrl.includes('reddit.com') || lowerUrl.includes('redd.it')) {
    return 'reddit';
  }
  // Podcast detection
  if (lowerUrl.includes('podcasts.apple.com') || 
      lowerUrl.includes('spotify.com/episode') || 
      lowerUrl.includes('podcasts.google.com') ||
      lowerUrl.includes('overcast.fm') ||
      lowerUrl.includes('pocketcasts.com')) {
    return 'podcast';
  }
  // IMDB Movie/TV detection - default to movie, will be refined by metadata
  if (lowerUrl.includes('imdb.com/title/')) {
    // URLs with /episodes or /season are definitely TV shows
    if (lowerUrl.includes('/episodes') || lowerUrl.includes('/season')) {
      return 'tv_show';
    }
    // Default to movie, but this will be refined by extractIMDBMetadata
    return 'movie';
  }
  // Image detection
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
    return 'image';
  }
  // Product pages
  if (lowerUrl.includes('amazon.com') || lowerUrl.includes('ebay.com')) {
    return 'product';
  }
  // Articles/blogs
  if (lowerUrl.includes('medium.com') || lowerUrl.includes('substack.com')) {
    return 'article';
  }
  // Code repositories
  if (lowerUrl.includes('github.com')) {
    return 'code';
  }
  // Video platforms (other than YouTube)
  if (lowerUrl.includes('vimeo.com') || lowerUrl.includes('dailymotion.com')) {
    return 'video';
  }
  
  return 'bookmark';
};

// Extract YouTube metadata using youtubei.js
const extractYouTubeMetadata = async (url: string): Promise<URLMetadata> => {
  try {
    const youtubeData = await extractYouTubeData(url);
    
    // Format duration
    let duration: string | undefined;
    if (youtubeData.duration) {
      const minutes = Math.floor(youtubeData.duration / 60);
      const seconds = youtubeData.duration % 60;
      duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    const metadata = {
      url,
      title: youtubeData.title,
      description: youtubeData.description,
      image: youtubeData.thumbnail,
      author: youtubeData.author,
      duration,
      contentType: youtubeData.isShort ? 'youtube_short' : 'youtube',
      siteName: 'YouTube',
    };
    
    // Fill any missing fields
    return fillMissingMetadata(metadata);
  } catch (error) {
    console.error('YouTube extraction failed, falling back to Jina:', error);
    // Fallback to Jina if YouTube extraction fails
    const metadata = await extractWithJina(url);
    const filledMetadata = await fillMissingMetadata({
      ...metadata,
      contentType: url.includes('/shorts/') ? 'youtube_short' : 'youtube',
      siteName: 'YouTube',
    });
    return filledMetadata;
  }
};

// Extract bookmark/generic URL metadata with emphasis on OG tags
const extractBookmarkMetadata = async (url: string): Promise<URLMetadata> => {
  try {
    console.log('Extracting bookmark metadata with enhanced OG tag support');
    const metadata = await extractWithJina(url);
    
    // Ensure we have all critical fields for bookmarks
    if (!metadata.title || metadata.title === 'No title' || metadata.title.startsWith('https://')) {
      console.log('Title missing or invalid, attempting to extract from URL');
      // Try to create a better title from the URL
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      if (pathParts.length > 0) {
        // Use the last meaningful part of the path as title
        const lastPart = pathParts[pathParts.length - 1]
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\.html?$/i, '')
          .replace(/\.php$/i, '');
        if (lastPart && lastPart.length > 3) {
          metadata.title = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
        } else {
          metadata.title = urlObj.hostname.replace('www.', '');
        }
      } else {
        metadata.title = urlObj.hostname.replace('www.', '');
      }
    }
    
    // Ensure we have a description
    if (!metadata.description) {
      metadata.description = `Bookmark from ${new URL(url).hostname}`;
    }
    
    // Log if we're missing an image
    if (!metadata.image) {
      console.log('No image found for bookmark:', url);
      // Could potentially use a screenshot service here in the future
    }
    
    const bookmarkMetadata = {
      ...metadata,
      contentType: detectURLType(url) as ContentType,
    };
    
    // Always try to fill missing fields
    return fillMissingMetadata(bookmarkMetadata);
  } catch (error) {
    console.error('Bookmark extraction failed:', error);
    
    // Even on error, provide usable metadata
    const urlObj = new URL(url);
    return {
      url,
      title: urlObj.hostname.replace('www.', ''),
      description: `Bookmark from ${urlObj.hostname}`,
      contentType: 'bookmark',
      siteName: urlObj.hostname,
      error: 'Failed to extract full metadata',
    };
  }
};

// Extract IMDB metadata (movies and TV shows)
const extractIMDBMetadata = async (url: string): Promise<URLMetadata> => {
  try {
    console.log('Extracting IMDB metadata');
    const metadata = await extractWithJina(url);
    
    // IMDB-specific detection based on metadata
    let contentType: ContentType = 'movie'; // default
    
    // Check the title and description for TV show indicators
    const combinedText = `${metadata.title || ''} ${metadata.description || ''}`.toLowerCase();
    
    // TV show indicators in metadata
    const tvShowIndicators = [
      'tv series',
      'tv mini series',
      'episode guide',
      'seasons',
      'episodes',
      '–)',  // IMDB uses this format for TV show years (e.g., "2008–2013)")
      'tv-ma',
      'tv-14',
      'tv-pg',
      'tv-y',
    ];
    
    // Check for TV show indicators
    const isTVShow = tvShowIndicators.some(indicator => combinedText.includes(indicator));
    
    // Also check if URL has TV show specific paths
    if (isTVShow || url.includes('/episodes') || url.includes('/season')) {
      contentType = 'tv_show';
    }
    
    // Clean up the title if it has IMDB suffix
    let title = metadata.title || 'IMDB Title';
    title = title.replace(' - IMDb', '').replace(' - IMDB', '');
    
    const imdbMetadata = {
      ...metadata,
      title,
      contentType,
      siteName: 'IMDb',
    };
    
    // Fill any missing fields
    return fillMissingMetadata(imdbMetadata);
  } catch (error) {
    console.error('IMDB extraction failed:', error);
    return {
      url,
      contentType: 'movie', // default to movie on error
      siteName: 'IMDb',
      error: 'Failed to extract IMDB metadata',
    };
  }
};

// Extract Reddit metadata
const extractRedditMetadata = async (url: string): Promise<URLMetadata> => {
  try {
    console.log('Using Jina for Reddit extraction');
    const metadata = await extractWithJina(url);
    
    // Reddit-specific parsing of Jina response
    let title = metadata.title || 'Reddit Post';
    let description = metadata.description || '';
    
    // Reddit OG titles often include "r/subreddit - Post Title"
    // Clean up the title format
    if (title.includes(' : ')) {
      // Format like "Post Title : r/subreddit"
      const parts = title.split(' : ');
      title = parts[0];
    } else if (title.includes(' - ')) {
      // Format like "r/subreddit - Post Title"
      const parts = title.split(' - ');
      if (parts.length > 1 && parts[0].startsWith('r/')) {
        title = parts.slice(1).join(' - ');
      }
    }
    
    // Extract subreddit from URL
    const subredditMatch = url.match(/reddit\.com\/r\/([^/]+)/);
    const subreddit = subredditMatch ? subredditMatch[1] : null;
    
    // Format the description to include subreddit info
    if (subreddit && !description.includes(`r/${subreddit}`)) {
      description = `r/${subreddit}${description ? ': ' + description : ''}`;
    }
    
    const redditMetadata = {
      ...metadata,
      title: title.slice(0, 200),
      description: description.slice(0, 500),
      contentType: 'reddit',
      siteName: 'Reddit',
      author: subreddit ? `r/${subreddit}` : metadata.author,
    };
    
    // Fill any missing fields
    return fillMissingMetadata(redditMetadata);
  } catch (jinaError) {
    console.error('Reddit extraction with Jina failed:', jinaError);
    return {
      url,
      contentType: 'reddit',
      siteName: 'Reddit',
      error: 'Failed to extract Reddit metadata',
    };
  }
};

// Extract TikTok metadata
const extractTikTokMetadata = async (url: string): Promise<URLMetadata> => {
  let metadata: URLMetadata | null = null;
  
  try {
    console.log('Extracting TikTok metadata with Jina');
    metadata = await extractWithJina(url);
  } catch (jinaError) {
    console.error('Jina extraction failed for TikTok:', jinaError);
    
    // Since Jina failed, create basic metadata from URL
    console.log('Creating fallback metadata for TikTok from URL');
    
    // Extract username from URL
    const usernameMatch = url.match(/@([a-zA-Z0-9._]+)/);
    const author = usernameMatch ? `@${usernameMatch[1]}` : undefined;
    
    // Extract video ID if possible
    const videoIdMatch = url.match(/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    metadata = {
      url,
      title: author ? `${author}'s TikTok Video` : 'TikTok Video',
      description: videoId ? `TikTok video ${videoId}` : 'TikTok video',
      contentType: 'tiktok',
      siteName: 'TikTok',
      author,
    };
  }
  
  // If we still don't have metadata, use defaults
  if (!metadata) {
    // Extract username from URL if possible
    const usernameMatch = url.match(/@([a-zA-Z0-9._]+)/);
    const author = usernameMatch ? `@${usernameMatch[1]}` : undefined;
    
    return {
      url,
      title: author ? `${author}'s TikTok Video` : 'TikTok Video',
      description: 'TikTok video',
      contentType: 'tiktok',
      siteName: 'TikTok',
      author,
      error: 'Failed to extract TikTok metadata',
    };
  }
  
  // TikTok-specific parsing of extracted metadata
  let title = metadata.title || 'TikTok Video';
  let description = metadata.description || '';
  
  // Clean up TikTok titles which often include "TikTok - Make Your Day"
  title = title.replace(' | TikTok', '').replace(' - TikTok', '').replace('TikTok - Make Your Day', '').trim();
  
  // Extract username from title, description, or URL
  let author = metadata.author;
  if (!author) {
    // Try to extract @username from title or description
    const contentMatch = (title + ' ' + description).match(/@([a-zA-Z0-9._]+)/);
    if (contentMatch) {
      author = `@${contentMatch[1]}`;
    } else {
      // Try URL
      const urlMatch = url.match(/@([a-zA-Z0-9._]+)/);
      if (urlMatch) {
        author = `@${urlMatch[1]}`;
      }
    }
  }
  
  // If title is too generic, try to use first part of description or author
  if (title === 'TikTok' || title === '' || title.length < 5) {
    if (description && description.length > 10) {
      title = description.slice(0, 100);
    } else if (author) {
      title = `${author}'s TikTok Video`;
    } else {
      title = 'TikTok Video';
    }
  }
  
  const tiktokMetadata = {
    ...metadata,
    title,
    description: description || 'TikTok video',
    contentType: 'tiktok' as ContentType,
    siteName: 'TikTok',
    author,
  };
  
  // Fill any missing fields
  return fillMissingMetadata(tiktokMetadata);
};

// Extract Instagram metadata
const extractInstagramMetadata = async (url: string): Promise<URLMetadata> => {
  // Always try Jina first since Meta oEmbed requires app review
  try {
    console.log('Using Jina for Instagram extraction');
    const metadata = await extractWithJina(url);
    
    // Instagram-specific parsing of Jina response
    let title = metadata.title || 'Instagram Post';
    let description = metadata.description || '';
    
    // Instagram OG titles are usually in format: "Username on Instagram: "Caption...""
    // or "Instagram photo by Username • Date"
    if (title.includes('Instagram')) {
      // Extract username from title if possible
      const onInstagramMatch = title.match(/^(.+?)\s+on Instagram:/);
      const photoByMatch = title.match(/Instagram photo by (.+?)[\s•]/);
      
      if (onInstagramMatch) {
        const username = onInstagramMatch[1];
        // Extract caption from after the colon
        const captionMatch = title.match(/on Instagram:\s*"?(.+)"?$/);
        const caption = captionMatch ? captionMatch[1] : description;
        title = `@${username}: ${caption.slice(0, 50)}${caption.length > 50 ? '...' : ''}`;
      } else if (photoByMatch) {
        const username = photoByMatch[1];
        title = `@${username}: ${description.slice(0, 50)}${description.length > 50 ? '...' : ''}`;
      } else if (description) {
        // Fallback: use description as title if it's better
        title = description.slice(0, 100) || 'Instagram Post';
      }
    }
    
    const instagramMetadata = {
      ...metadata,
      title,
      description: description || 'Instagram post',
      contentType: 'instagram',
      siteName: 'Instagram',
    };
    
    // Fill any missing fields
    return fillMissingMetadata(instagramMetadata);
  } catch (jinaError) {
    console.error('Jina extraction failed:', jinaError);
    
    // If Jina fails and Instagram API is configured, try Meta oEmbed
    if (isAPIConfigured.instagram()) {
      try {
        const postId = extractInstagramPostId(url);
        if (!postId) {
          throw new Error('Invalid Instagram URL - could not extract post ID');
        }
        
        const instagramData = await fetchInstagramData(url);
        
        const title = instagramData.author?.username 
          ? `@${instagramData.author.username}: ${instagramData.caption?.slice(0, 50)}${instagramData.caption && instagramData.caption.length > 50 ? '...' : ''}`
          : instagramData.caption?.slice(0, 100) || 'Instagram Post';
        
        const description = instagramData.caption || 'Instagram post';
        
        const metaMetadata = {
          url,
          title,
          description,
          image: instagramData.thumbnail || url,
          author: instagramData.author?.username ? `@${instagramData.author.username}` : undefined,
          contentType: 'instagram',
          siteName: 'Instagram',
        };
        
        // Fill any missing fields
        return fillMissingMetadata(metaMetadata);
      } catch (metaError) {
        console.error('Meta oEmbed also failed:', metaError);
      }
    }
    
    // Final fallback
    return {
      url,
      title: 'Instagram Post',
      contentType: 'instagram',
      siteName: 'Instagram',
      error: 'Failed to extract Instagram metadata',
    };
  }
};

// Extract Twitter/X metadata
const extractTwitterMetadata = async (url: string): Promise<URLMetadata> => {
  if (!isAPIConfigured.twitter()) {
    console.log('Twitter API not configured, falling back to Jina');
    // Fallback to Jina if Twitter API is not configured
    const metadata = await extractWithJina(url);
    const filledMetadata = await fillMissingMetadata({
      ...metadata,
      contentType: 'x',
      siteName: 'X (Twitter)',
    });
    return filledMetadata;
  }

  try {
    // Extract tweet ID from URL
    const tweetId = extractTweetId(url);
    if (!tweetId) {
      throw new Error('Invalid Twitter URL - could not extract tweet ID');
    }
    
    // Fetch comprehensive tweet data
    const tweetData = await fetchTweetData(tweetId);
    
    // Build title with author info
    const title = `@${tweetData.author.username}: ${tweetData.text.slice(0, 50)}${tweetData.text.length > 50 ? '...' : ''}`;
    
    // Build description with metrics
    const metricsText = `❤️ ${tweetData.metrics.likes.toLocaleString()} · 🔄 ${tweetData.metrics.retweets.toLocaleString()} · 💬 ${tweetData.metrics.replies.toLocaleString()}`;
    const timeAgo = formatTweetDate(tweetData.createdAt);
    
    let description = tweetData.text;
    if (tweetData.quotedTweet) {
      description += `\n\nQuoted ${tweetData.quotedTweet.author}: "${tweetData.quotedTweet.text}"`;
    }
    description += `\n\n${metricsText} · ${timeAgo}`;
    
    // Get media - separate videos and images
    const videoMedia = tweetData.media?.find(m => m.type === 'video' || m.type === 'animated_gif');
    const photoMedia = tweetData.media?.filter(m => m.type === 'photo') || [];
    
    // Get all image URLs
    const imageUrls = photoMedia.map(m => m.url);
    const firstImage = imageUrls[0] || tweetData.author.profileImage;
    
    // Debug logging
    if (videoMedia) {
      console.log('Video media found:', {
        type: videoMedia.type,
        url: videoMedia.url,
        previewUrl: videoMedia.previewUrl,
        hasVariants: !!videoMedia.variants
      });
    }
    
    if (imageUrls.length > 1) {
      console.log(`Multiple images found: ${imageUrls.length} images`);
    }
    
    const twitterMetadata = {
      url,
      title,
      description,
      image: videoMedia?.previewUrl || firstImage, // Use video preview or first image
      images: imageUrls.length > 0 ? imageUrls : undefined, // All image URLs
      videoUrl: videoMedia?.url, // Add video URL if available
      author: `${tweetData.author.name} (@${tweetData.author.username})`,
      contentType: 'x',
      siteName: 'X (Twitter)',
      publishedDate: tweetData.createdAt,
    };
    
    // Fill any missing fields
    return fillMissingMetadata(twitterMetadata);
  } catch (error) {
    console.error('Twitter extraction error:', error);
    console.log('Falling back to Jina for Twitter URL');
    
    // Fallback to Jina if Twitter API fails
    try {
      const metadata = await extractWithJina(url);
      const filledMetadata = await fillMissingMetadata({
        ...metadata,
        contentType: 'x',
        siteName: 'X (Twitter)',
      });
      return filledMetadata;
    } catch (jinaError) {
      console.error('Jina fallback also failed:', jinaError);
      return {
        url,
        contentType: 'x',
        siteName: 'X (Twitter)',
        error: 'Failed to extract Twitter metadata',
      };
    }
  }
};

// Extract metadata using Jina.ai with comprehensive fallbacks
const extractWithJina = async (url: string): Promise<URLMetadata> => {
  if (!isAPIConfigured.jina()) {
    console.error('Jina API not configured - check EXPO_PUBLIC_JINA_AI_API_KEY in .env.local');
    return {
      url,
      contentType: detectURLType(url),
      error: 'Jina API not configured',
    };
  }

  try {
    console.log('Calling Jina.ai API for:', url);
    const jinaUrl = `${API_CONFIG.JINA_AI.BASE_URL}/${encodeURIComponent(url)}`;
    
    const response = await fetch(jinaUrl, {
      headers: {
        'Authorization': `Bearer ${API_CONFIG.JINA_AI.API_KEY}`,
        'Accept': 'application/json',
        'X-With-Images-Summary': 'true',
        'X-With-Links-Summary': 'true',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jina API error response:', response.status, errorText);
      throw new Error(`Jina API error: ${response.status}`);
    }
    
    const response_data = await response.json();
    console.log('Jina.ai response structure:', { 
      hasData: !!response_data.data,
      hasMetadata: !!response_data.data?.metadata,
      metadataKeys: response_data.data?.metadata ? Object.keys(response_data.data.metadata).slice(0, 10) : [],
      hasOGTitle: !!(response_data.data?.metadata?.['og:title'] || response_data.data?.metadata?.ogTitle),
      hasOGDescription: !!(response_data.data?.metadata?.['og:description'] || response_data.data?.metadata?.ogDescription),
      hasOGImage: !!(response_data.data?.metadata?.['og:image'] || response_data.data?.metadata?.ogImage)
    });
    
    // Handle new Jina response structure (data.data contains the actual content)
    const jinaContent = response_data.data || response_data;
    const metadata = jinaContent.metadata || {};
    
    // Extract all available metadata with priority order
    // Priority: OG (Open Graph) > Twitter Card > Standard metadata > Raw content
    
    // Extract title with fallbacks - check both metadata and direct fields
    const title = metadata['og:title'] || 
                  metadata.ogTitle ||
                  jinaContent.ogTitle ||
                  metadata['twitter:title'] ||
                  metadata.twitterTitle ||
                  jinaContent.twitterTitle ||
                  metadata.title ||
                  metadata['apple:title'] ||
                  jinaContent.title || 
                  jinaContent.headline ||
                  'No title';
    
    // Extract description with fallbacks  
    const description = metadata['og:description'] || 
                        metadata.ogDescription ||
                        jinaContent.ogDescription ||
                        metadata['twitter:description'] ||
                        metadata.twitterDescription ||
                        jinaContent.twitterDescription ||
                        metadata.description ||
                        metadata['apple:description'] ||
                        jinaContent.description || 
                        jinaContent.excerpt || 
                        jinaContent.summary ||
                        jinaContent.text?.slice(0, 200) ||
                        jinaContent.content?.slice(0, 200) ||
                        '';
    
    // Extract image with fallbacks
    const image = metadata['og:image'] ||
                  metadata.ogImage ||
                  jinaContent.ogImage ||
                  metadata['og:image:secure_url'] ||
                  metadata['twitter:image'] ||
                  metadata.twitterImage ||
                  jinaContent.twitterImage ||
                  jinaContent.images?.[0]?.url || 
                  jinaContent.image || 
                  jinaContent.screenshot ||
                  jinaContent.thumbnail;
    
    // Extract site name with fallbacks
    const siteName = metadata['og:site_name'] ||
                     metadata.ogSiteName ||
                     jinaContent.ogSiteName ||
                     metadata.siteName ||
                     jinaContent.siteName || 
                     jinaContent.publisher || 
                     jinaContent.source ||
                     new URL(url).hostname;
    
    // Extract author with fallbacks
    const author = jinaContent.author || 
                   jinaContent.authors?.[0] || 
                   jinaContent.creator || 
                   metadata['twitter:creator'] ||
                   metadata.twitterCreator ||
                   jinaContent.twitterCreator ||
                   jinaContent.byline;
    
    return {
      url,
      title,
      description,
      image,
      siteName,
      favicon: jinaContent.favicon || jinaContent.icon || metadata.favicon,
      author,
      publishedDate: jinaContent.publishedTime || jinaContent.datePublished || jinaContent.publishedDate || metadata.publishedDate,
      contentType: detectURLType(url),
    };
  } catch (error) {
    console.error('Jina extraction error:', error);
    return {
      url,
      contentType: detectURLType(url),
      error: 'Failed to extract metadata',
    };
  }
};

// Fill missing metadata fields using Jina as fallback
const fillMissingMetadata = async (metadata: URLMetadata): Promise<URLMetadata> => {
  // Check if we have critical missing fields
  const missingFields = [];
  if (!metadata.title || metadata.title === 'No title' || metadata.title === 'https://podcasts.apple.com/us/podcast/the-greatest') {
    missingFields.push('title');
  }
  if (!metadata.description) missingFields.push('description');
  if (!metadata.image) missingFields.push('image');
  
  // If we have all critical fields, return as-is
  if (missingFields.length === 0) {
    return metadata;
  }
  
  // Skip refetching if there's already an error (prevents infinite loops)
  if (metadata.error) {
    return metadata;
  }
  
  console.log(`Missing metadata fields for ${metadata.url}: ${missingFields.join(', ')}`);
  console.log('Attempting to fill gaps with Jina.ai...');
  
  try {
    // Try to get additional metadata from Jina
    const jinaMetadata = await extractWithJina(metadata.url);
    
    // Fill in missing fields while preserving existing good data
    const filledMetadata = {
      ...metadata,
      title: (metadata.title && metadata.title !== 'No title' && !metadata.title.startsWith('https://')) ? 
             metadata.title : jinaMetadata.title,
      description: metadata.description || jinaMetadata.description,
      image: metadata.image || jinaMetadata.image,
      siteName: metadata.siteName || jinaMetadata.siteName,
      favicon: metadata.favicon || jinaMetadata.favicon,
      author: metadata.author || jinaMetadata.author,
      publishedDate: metadata.publishedDate || jinaMetadata.publishedDate,
    };
    
    // Log what was filled
    const filled = [];
    if (filledMetadata.title !== metadata.title) {
      filled.push(`title: "${filledMetadata.title}"`);
    }
    if (filledMetadata.description !== metadata.description) {
      filled.push(`description: "${filledMetadata.description?.slice(0, 50)}..."`);
    }
    if (filledMetadata.image !== metadata.image) {
      filled.push(`image: ${filledMetadata.image ? 'found' : 'not found'}`);
    }
    
    if (filled.length > 0) {
      console.log(`Metadata gaps filled - ${filled.join(', ')}`);
    }
    
    return filledMetadata;
  } catch (error) {
    console.error('Failed to fill metadata gaps:', error);
    // Return original metadata if Jina fails
    return metadata;
  }
};

// Main extraction function
export const extractURLMetadata = async (url: string): Promise<URLMetadata> => {
  console.log('Extracting metadata for URL:', url);
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    console.log('Invalid URL format');
    return {
      url,
      contentType: 'note',
      error: 'Invalid URL',
    };
  }

  const urlType = detectURLType(url);
  console.log('Detected URL type:', urlType);
  
  // Route to appropriate extractor
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    console.log('Using YouTube extractor');
    return extractYouTubeMetadata(url);
  }
  
  if (url.includes('twitter.com') || url.includes('x.com')) {
    console.log('Using Twitter extractor');
    return extractTwitterMetadata(url);
  }
  
  if (url.includes('instagram.com')) {
    console.log('Using Instagram extractor');
    return extractInstagramMetadata(url);
  }
  
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
    console.log('Using TikTok extractor');
    return extractTikTokMetadata(url);
  }
  
  if (url.includes('reddit.com') || url.includes('redd.it')) {
    console.log('Using Reddit extractor');
    return extractRedditMetadata(url);
  }
  
  if (url.includes('imdb.com/title/')) {
    console.log('Using IMDB extractor');
    return extractIMDBMetadata(url);
  }
  
  // Use enhanced bookmark extractor for all other URLs
  console.log('Using bookmark extractor for general URL');
  return extractBookmarkMetadata(url);
};

// Generate tags using OpenAI
export const generateTags = async (content: string, metadata?: URLMetadata): Promise<string[]> => {
  if (!isAPIConfigured.openai()) {
    console.warn('OpenAI API not configured');
    return [];
  }

  try {
    const openai = new OpenAI({
      apiKey: API_CONFIG.OPENAI.API_KEY,
    });

    const prompt = `Based on the following content and metadata, generate 3-5 relevant tags (single words or short phrases):

Title: ${metadata?.title || 'N/A'}
Description: ${metadata?.description || 'N/A'}
Content: ${content.slice(0, 500)}

Return only the tags as a comma-separated list, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: API_CONFIG.OPENAI.MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates relevant tags for content organization.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const tagsText = completion.choices[0]?.message?.content || '';
    const tags = tagsText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0 && tag.length < 30);

    return tags;
  } catch (error) {
    console.error('Tag generation error:', error);
    return [];
  }
};