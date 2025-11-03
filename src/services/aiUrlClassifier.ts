import OpenAI from 'openai';
import { API_CONFIG, isAPIConfigured } from '../config/api';
import { ContentType } from '../types';

/**
 * AI-powered URL classifier
 *
 * Uses LLM to intelligently classify URLs that don't match hardcoded patterns.
 * This is a fallback for the many edge cases we can't anticipate:
 * - Product pages from various retailers (Walmart, Target, Etsy, etc.)
 * - Article/blog platforms we haven't added yet
 * - New platforms and URL patterns
 *
 * Cost: ~$0.0002 per classification (very cheap!)
 *
 * @param url - The URL to classify
 * @param pageTitle - Optional page title to help with classification
 * @param pageDescription - Optional page description to help with classification
 * @returns ContentType or null if classification fails
 */
export const classifyUrlWithAI = async (
  url: string,
  context?: {
    pageTitle?: string;
    pageDescription?: string;
    siteName?: string;
  }
): Promise<ContentType | null> => {
  if (!isAPIConfigured.openai()) {
    console.log('OpenAI not configured, skipping AI URL classification');
    return null;
  }

  try {
    console.log('Using AI to classify URL:', url);

    const openai = new OpenAI({
      apiKey: API_CONFIG.OPENAI.API_KEY,
    });

    // Build context for better classification
    const contextLines = [];
    if (context?.pageTitle) contextLines.push(`Page Title: "${context.pageTitle}"`);
    if (context?.pageDescription) contextLines.push(`Description: "${context.pageDescription.slice(0, 200)}"`);
    if (context?.siteName) contextLines.push(`Site: ${context.siteName}`);

    const prompt = `Classify this URL into ONE of the following content types:

URL: ${url}
${contextLines.length > 0 ? contextLines.join('\n') : ''}

Available types:
- product: E-commerce product pages (Amazon, Walmart, Etsy, Target, eBay, Shopify stores, etc.)
- article: Blog posts, news articles, written content (Medium, blogs, news sites, etc.)
- video: Video content from non-YouTube platforms (Vimeo, Dailymotion, Wistia, etc.)
- youtube: YouTube videos (youtube.com, youtu.be, m.youtube.com, music.youtube.com)
- youtube_short: YouTube Shorts (youtube.com/shorts/...)
- x: X (Twitter) posts or videos (x.com, twitter.com)
- reddit: Reddit posts or comments (reddit.com)
- github: GitHub repositories, issues, PRs, code files (github.com)
- instagram: Instagram posts or reels (instagram.com)
- tiktok: TikTok videos (tiktok.com)
- linkedin: LinkedIn posts or articles (linkedin.com)
- threads: Threads posts (threads.net)
- facebook: Facebook posts or videos (facebook.com)
- amazon: Amazon product pages (amazon.com)
- ebay: eBay product pages (ebay.com)
- yelp: Yelp business pages (yelp.com)
- app_store: Apple App Store apps (apps.apple.com)
- image: Image galleries or standalone images
- pdf: PDF documents
- audio: Audio files or music pages
- podcast: Podcast episodes or shows
- course: Online courses or educational content
- book: Book pages or book retailers
- movie: Movie pages (IMDb, Letterboxd, etc.)
- tv_show: TV show pages (IMDb, Rotten Tomatoes, etc.)
- note: A user-authored note page (only if clearly a note editor)
- bookmark: None of the above - generic web page

Rules:
1. YouTube (youtube.com, youtu.be, m.youtube.com, music.youtube.com):
   - If it's a Shorts URL (path contains /shorts/) → 'youtube_short'
   - Otherwise → 'youtube'
2. X/Twitter (x.com, twitter.com) → 'x' (not 'video')
3. Reddit (reddit.com) → 'reddit'
4. GitHub (github.com) → 'github'
5. Instagram (instagram.com) → 'instagram'
6. TikTok (tiktok.com) → 'tiktok'
7. LinkedIn (linkedin.com) → 'linkedin'
8. Threads (threads.net) → 'threads'
9. Facebook (facebook.com) → 'facebook'
10. Amazon (amazon.com, smile.amazon.com) → 'amazon' if a product page
11. eBay (ebay.com) → 'ebay'
12. Yelp (yelp.com) → 'yelp'
13. Apple App Store (apps.apple.com) → 'app_store'
14. If it's clearly a product for sale → product
15. If it's an article, blog post, or news → article
16. If it's a non-YouTube video platform (Vimeo, Dailymotion, etc.) → video
17. If it's educational course content → course
18. If it's a book or about books → book
19. Only use 'note' if it unmistakably represents a user-authored note/editor page; otherwise do not use 'note'
20. If none of the above apply → bookmark

CRITICAL: If the URL contains youtube.com or youtu.be, you MUST return 'youtube'/'youtube_short' accordingly. If it contains x.com or twitter.com, you MUST return 'x'.

Return ONLY the content type, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cheap for classification
      messages: [
        {
          role: 'system',
          content: 'You are a URL classifier. You only return one word: the content type.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Very low for consistent classification
      max_tokens: 20, // We only need one word
    });

    const classification = completion.choices[0]?.message?.content?.trim().toLowerCase();

    // Validate the response is a valid content type
    const validTypes: ContentType[] = [
      'bookmark',
      'youtube',
      'youtube_short',
      'x',
      'github',
      'instagram',
      'facebook',
      'threads',
      'tiktok',
      'reddit',
      'amazon',
      'ebay',
      'yelp',
      'app_store',
      'linkedin',
      'image',
      'pdf',
      'video',
      'audio',
      'podcast',
      'podcast_episode',
      'note',
      'article',
      'product',
      'book',
      'course',
      'movie',
      'tv_show',
    ];

    if (classification && validTypes.includes(classification as ContentType)) {
      console.log(`AI classified URL as: ${classification}`);
      return classification as ContentType;
    }

    console.warn('AI returned invalid classification:', classification);
    return null;
  } catch (error) {
    console.error('AI URL classification failed:', error);
    return null;
  }
};

/**
 * Convenience function: Classify a URL as a product or not
 * Useful for quick product detection without full classification
 */
export const isProductUrl = async (url: string, context?: { pageTitle?: string }): Promise<boolean> => {
  const classification = await classifyUrlWithAI(url, context);
  return classification === 'product';
};

/**
 * Convenience function: Classify a URL as an article or not
 * Useful for quick article detection without full classification
 */
export const isArticleUrl = async (url: string, context?: { pageTitle?: string; pageDescription?: string }): Promise<boolean> => {
  const classification = await classifyUrlWithAI(url, context);
  return classification === 'article';
};

/**
 * Podcast URL classifier - differentiates episode vs homepage
 *
 * Analyzes podcast platform URLs to determine if they point to a specific episode
 * or a podcast show homepage. Also attempts to extract episode title.
 *
 * @param url - The podcast URL to classify
 * @returns Object with isEpisode boolean and optional title
 */
export interface PodcastClassificationResult {
  isEpisode: boolean;
  title?: string;
}

export async function classifyPodcastUrl(url: string): Promise<PodcastClassificationResult> {
  if (!isAPIConfigured.openai()) {
    console.log('OpenAI not configured, falling back to URL pattern matching');
    // Fallback to basic URL pattern matching
    const isEpisode = url.includes('?i=') || url.includes('/episode/');
    return { isEpisode };
  }

  try {
    console.log('🎙️ Classifying podcast URL:', url);

    const openai = new OpenAI({
      apiKey: API_CONFIG.OPENAI.API_KEY,
    });

    const prompt = `Analyze this podcast URL and determine:
1. Is this a specific podcast EPISODE (with audio content) or a podcast HOMEPAGE/SHOW page?
2. If it's an episode and you can extract the episode title from the URL path or metadata, provide it.

URL: ${url}

URL Pattern Clues:
- Apple Podcasts episodes contain "?i=" parameter (episode ID)
- Spotify episodes have "/episode/" in path
- Spotify shows have "/show/" in path
- Overcast episodes have extra path segments beyond podcast ID
- Episode URLs typically have more specific path segments than homepage URLs

Respond in JSON format:
{
  "isEpisode": true/false,
  "title": "episode title if you can extract it, otherwise null"
}

Examples:
- "https://podcasts.apple.com/podcast/name/id123?i=456" → {"isEpisode": true, "title": null}
- "https://podcasts.apple.com/podcast/name/id123" → {"isEpisode": false, "title": null}
- "https://spotify.com/episode/abc" → {"isEpisode": true, "title": null}
- "https://spotify.com/show/abc" → {"isEpisode": false, "title": null}

IMPORTANT: Base your decision primarily on the URL structure. Episodes have specific identifiers like "?i=" or "/episode/". If unsure, check for these patterns.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a podcast URL analyzer. Return ONLY valid JSON matching the schema provided.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log('🎙️ No response from AI, defaulting to non-episode');
      return { isEpisode: false };
    }

    const result = JSON.parse(content) as PodcastClassificationResult;
    console.log('🎙️ AI classification result:', result);

    return result;
  } catch (error) {
    console.error('Error classifying podcast URL:', error);
    // Default to non-episode on error (safer)
    return { isEpisode: false };
  }
}

/**
 * Example usage:
 *
 * // Basic classification
 * const type = await classifyUrlWithAI('https://www.walmart.com/ip/some-product/123');
 * // Returns: 'product'
 *
 * // With context for better accuracy
 * const type = await classifyUrlWithAI(
 *   'https://example-store.com/items/abc123',
 *   {
 *     pageTitle: 'Premium Widget - $29.99',
 *     pageDescription: 'Buy our premium widget with free shipping',
 *     siteName: 'Example Store'
 *   }
 * );
 * // Returns: 'product'
 *
 * // Blog post
 * const type = await classifyUrlWithAI(
 *   'https://someblog.com/how-to-code',
 *   {
 *     pageTitle: 'How to Learn Programming in 2024',
 *     pageDescription: 'A comprehensive guide to...'
 *   }
 * );
 * // Returns: 'article'
 */
