import OpenAI from 'openai';
import { API_CONFIG, isAPIConfigured } from '../config/api';
import { extractYouTubeData } from './youtube';
import { extractTweetId, fetchTweetData, formatTweetDate } from './twitter';

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
    
    return {
      url,
      title: youtubeData.title,
      description: youtubeData.description,
      image: youtubeData.thumbnail,
      author: youtubeData.author,
      duration,
      contentType: youtubeData.isShort ? 'youtube_short' : 'youtube',
      siteName: 'YouTube',
    };
  } catch (error) {
    console.error('YouTube extraction failed, falling back to Jina:', error);
    // Fallback to Jina if YouTube extraction fails
    const metadata = await extractWithJina(url);
    return {
      ...metadata,
      contentType: 'youtube',
      siteName: 'YouTube',
    };
  }
};

// Extract Twitter/X metadata
const extractTwitterMetadata = async (url: string): Promise<URLMetadata> => {
  if (!isAPIConfigured.twitter()) {
    console.log('Twitter API not configured, falling back to Jina');
    // Fallback to Jina if Twitter API is not configured
    const metadata = await extractWithJina(url);
    return {
      ...metadata,
      contentType: 'x',
      siteName: 'X (Twitter)',
    };
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
    
    return {
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
  } catch (error) {
    console.error('Twitter extraction error:', error);
    console.log('Falling back to Jina for Twitter URL');
    
    // Fallback to Jina if Twitter API fails
    try {
      const metadata = await extractWithJina(url);
      return {
        ...metadata,
        contentType: 'x',
        siteName: 'X (Twitter)',
      };
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

// Extract metadata using Jina.ai
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
    
    const data = await response.json();
    console.log('Jina.ai response data:', data);
    
    // Extract the best available image
    const image = data.images?.[0]?.url || 
                  data.image || 
                  data.ogImage ||
                  data.screenshot;
    
    return {
      url,
      title: data.title || data.ogTitle || 'No title',
      description: data.description || data.excerpt || data.ogDescription || data.text?.slice(0, 200),
      image,
      siteName: data.siteName || data.publisher || new URL(url).hostname,
      favicon: data.favicon || data.icon,
      author: data.author || data.authors?.[0],
      publishedDate: data.publishedTime || data.datePublished,
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
  
  // Use Jina for all other URLs
  console.log('Using Jina.ai for general URL extraction');
  return extractWithJina(url);
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