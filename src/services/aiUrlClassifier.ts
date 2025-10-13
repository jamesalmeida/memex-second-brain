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
- video: Video content (not YouTube - we handle that separately)
- image: Image galleries or standalone images
- podcast: Podcast episodes or shows
- course: Online courses or educational content
- book: Book pages or book retailers
- bookmark: None of the above - generic web page

Rules:
1. If it's clearly a product for sale → product
2. If it's an article, blog post, or news → article
3. If it's educational course content → course
4. If it's a book or about books → book
5. If none of the above apply → bookmark

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
      'product',
      'article',
      'video',
      'image',
      'podcast',
      'course',
      'book',
      'bookmark',
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
