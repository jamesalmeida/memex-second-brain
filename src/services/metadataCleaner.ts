import OpenAI from 'openai';
import { API_CONFIG, isAPIConfigured } from '../config/api';
import { aiSettingsComputed } from '../stores/aiSettings';

export interface MetadataCleanerOptions {
  /**
   * The raw metadata to clean/extract from
   */
  rawData: {
    title?: string;
    description?: string;
    content?: string;
    url?: string;
  };

  /**
   * What to extract/clean
   */
  extract: {
    title?: boolean;
    description?: boolean;
    both?: boolean;
  };

  /**
   * Content-type specific instructions
   */
  context?: {
    contentType?: string;
    instructions?: string;
  };
}

export interface CleanedMetadata {
  title?: string;
  description?: string;
}

/**
 * Use LLM to intelligently extract or clean metadata from messy/incomplete data
 * This is a fallback for when regex/parsing fails or produces poor results
 *
 * Cost: ~$0.0002-0.0003 per call (using gpt-4o-mini)
 *
 * @example
 * // Extract clean product title from Amazon description
 * const result = await cleanMetadataWithLLM({
 *   rawData: { description: "Baby University Complete for..." },
 *   extract: { title: true },
 *   context: { contentType: 'product', instructions: 'Extract product name only, no authors' }
 * });
 *
 * @example
 * // Clean both title and description for any content type
 * const result = await cleanMetadataWithLLM({
 *   rawData: { title: "Messy Title - Site Name | Extra Stuff", description: "..." },
 *   extract: { both: true },
 *   context: { contentType: 'article' }
 * });
 */
export const cleanMetadataWithLLM = async (
  options: MetadataCleanerOptions
): Promise<CleanedMetadata | null> => {
  if (!isAPIConfigured.openai()) {
    console.warn('OpenAI not configured, skipping LLM metadata cleaning');
    return null;
  }

  const { rawData, extract, context } = options;

  try {
    const openai = new OpenAI({
      apiKey: API_CONFIG.OPENAI.API_KEY,
    });

    // Build the prompt based on what we're extracting
    let task = '';
    if (extract.both) {
      task = 'Extract and clean both the title and description';
    } else if (extract.title) {
      task = 'Extract a clean, concise title';
    } else if (extract.description) {
      task = 'Extract a clean, concise description';
    }

    // Add content-specific context
    const contentContext = context?.contentType
      ? `Content type: ${context.contentType}\n`
      : '';

    const customInstructions = context?.instructions
      ? `\nSpecific instructions: ${context.instructions}\n`
      : '';

    // Build data section
    const dataLines = [];
    if (rawData.title) dataLines.push(`Title: "${rawData.title}"`);
    if (rawData.description) dataLines.push(`Description: "${rawData.description}"`);
    if (rawData.content) dataLines.push(`Content: "${rawData.content.slice(0, 500)}..."`);
    if (rawData.url) dataLines.push(`URL: ${rawData.url}`);

    const prompt = `${task} from the following data:

${contentContext}${customInstructions}
${dataLines.join('\n')}

${extract.both
  ? 'Return a JSON object with "title" and "description" fields.'
  : extract.title
    ? 'Return ONLY the title, nothing else.'
    : 'Return ONLY the description, nothing else.'
}`;

    const systemPrompt = extract.both
      ? 'You extract and clean metadata from web content. Always return valid JSON with "title" and "description" fields.'
      : 'You extract and clean metadata from web content. Return only the requested information, nothing else.';

    // Use user's selected metadata model, fallback to gpt-4o-mini
    const selectedModel = aiSettingsComputed.metadataModel?.() || 'gpt-4o-mini';

    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistent extraction
      max_tokens: 150,
      ...(extract.both && { response_format: { type: 'json_object' } }),
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      return null;
    }

    // Parse response based on extraction type
    if (extract.both) {
      try {
        const parsed = JSON.parse(response);
        return {
          title: parsed.title || undefined,
          description: parsed.description || undefined,
        };
      } catch (error) {
        console.error('Failed to parse LLM JSON response:', error);
        return null;
      }
    } else if (extract.title) {
      return { title: response };
    } else if (extract.description) {
      return { description: response };
    }

    return null;
  } catch (error) {
    console.error('LLM metadata cleaning error:', error);
    return null;
  }
};

/**
 * Convenience function specifically for product title extraction
 */
export const extractProductTitle = async (
  description: string,
  options?: { excludeAuthors?: boolean; excludeBrand?: boolean }
): Promise<string | null> => {
  const instructions = [];
  if (options?.excludeAuthors) instructions.push('no author names');
  if (options?.excludeBrand) instructions.push('no brand name');

  const result = await cleanMetadataWithLLM({
    rawData: { description },
    extract: { title: true },
    context: {
      contentType: 'product',
      instructions: instructions.length > 0
        ? `Extract product name only: ${instructions.join(', ')}`
        : 'Extract the product name/title',
    },
  });

  return result?.title || null;
};

/**
 * Convenience function for cleaning article metadata
 */
export const cleanArticleMetadata = async (
  title?: string,
  description?: string
): Promise<CleanedMetadata | null> => {
  return cleanMetadataWithLLM({
    rawData: { title, description },
    extract: { both: true },
    context: {
      contentType: 'article',
      instructions: 'Remove site names, navigation text, and promotional content',
    },
  });
};

/**
 * Convenience function for social media posts
 */
export const cleanSocialPostMetadata = async (
  rawText: string,
  platform: string
): Promise<CleanedMetadata | null> => {
  return cleanMetadataWithLLM({
    rawData: { content: rawText },
    extract: { both: true },
    context: {
      contentType: platform,
      instructions: 'Create a clear title and description from this social post',
    },
  });
};
