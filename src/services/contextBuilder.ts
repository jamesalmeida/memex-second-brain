import { Item, ContentType } from '../types';
import { videoTranscriptsComputed } from '../stores/videoTranscripts';
import { itemMetadataComputed } from '../stores/itemMetadata';
import { itemTypeMetadataComputed } from '../stores/itemTypeMetadata';

export interface ContextMetadata {
  includedFields: string[];
  wordCount: number;
  hasTranscript: boolean;
  contentType: ContentType;
}

export interface ContextResult {
  contextString: string;
  metadata: ContextMetadata;
}

/**
 * Builds a rich context string from an item for AI chat
 * Includes title, description, content, URL, transcript (for videos), and more
 */
export const buildItemContext = (item: Item): ContextResult => {
  const includedFields: string[] = [];
  const contextParts: string[] = [];

  // Add current date/time
  const now = new Date();
  contextParts.push(`Current Date/Time: ${now.toISOString()}`);
  contextParts.push('');

  // Add content type
  const contentTypeLabel = getContentTypeLabel(item.content_type);
  contextParts.push(`Content Type: ${contentTypeLabel}`);
  includedFields.push('content_type');

  // Add title
  if (item.title) {
    contextParts.push(`Title: ${item.title}`);
    includedFields.push('title');
  }

  // Add URL
  if (item.url) {
    contextParts.push(`URL: ${item.url}`);
    includedFields.push('url');
  }

  // Add description
  if (item.desc) {
    contextParts.push(`Description: ${item.desc}`);
    includedFields.push('description');
  }

  contextParts.push('');

  // Add metadata (author, username, domain, etc.)
  const metadata = itemMetadataComputed.getMetadataForItem(item.id);
  if (metadata) {
    const metadataParts: string[] = [];
    if (metadata.author) {
      metadataParts.push(`Author: ${metadata.author}`);
      includedFields.push('author');
    }
    if (metadata.username) {
      metadataParts.push(`Username: @${metadata.username}`);
      includedFields.push('username');
    }
    if (metadata.domain) {
      metadataParts.push(`Domain: ${metadata.domain}`);
      includedFields.push('domain');
    }
    if (metadata.published_date) {
      metadataParts.push(`Published: ${metadata.published_date}`);
      includedFields.push('published_date');
    }

    if (metadataParts.length > 0) {
      contextParts.push(metadataParts.join('\n'));
      contextParts.push('');
    }
  }

  // Add type-specific metadata
  const typeMetadata = itemTypeMetadataComputed.getTypeMetadataForItem(item.id);
  if (typeMetadata?.data) {
    if (typeMetadata.data.video_url) {
      contextParts.push(`Video URL: ${typeMetadata.data.video_url}`);
      includedFields.push('video_url');
    }
    if (typeMetadata.data.image_urls && Array.isArray(typeMetadata.data.image_urls)) {
      contextParts.push(`Images: ${typeMetadata.data.image_urls.length} image(s)`);
      includedFields.push('image_urls');
    }
  }

  // Add transcript for video content
  let hasTranscript = false;
  const transcript = videoTranscriptsComputed.getTranscriptByItemId(item.id);
  if (transcript) {
    hasTranscript = true;
    const transcriptWords = transcript.transcript.split(/\s+/).length;
    contextParts.push(`\n--- Video Transcript (${transcriptWords} words) ---`);
    contextParts.push(transcript.transcript);
    contextParts.push('--- End Transcript ---\n');
    includedFields.push('transcript');
  }

  // Add main content
  if (item.content) {
    contextParts.push(`\n--- Content ---`);
    contextParts.push(item.content);
    contextParts.push('--- End Content ---\n');
    includedFields.push('content');
  }

  // Add raw text (for extracted article content, etc.)
  if (item.raw_text && item.raw_text !== item.content) {
    const rawTextPreview = item.raw_text.substring(0, 2000);
    contextParts.push(`\n--- Extracted Text (Preview) ---`);
    contextParts.push(rawTextPreview);
    if (item.raw_text.length > 2000) {
      contextParts.push('\n[Text truncated for length...]');
    }
    contextParts.push('--- End Extracted Text ---\n');
    includedFields.push('raw_text');
  }

  // Add tags
  if (item.tags && item.tags.length > 0) {
    contextParts.push(`\nTags: ${item.tags.join(', ')}`);
    includedFields.push('tags');
  }

  const contextString = contextParts.join('\n');
  const wordCount = contextString.split(/\s+/).length;

  return {
    contextString,
    metadata: {
      includedFields,
      wordCount,
      hasTranscript,
      contentType: item.content_type,
    },
  };
};

/**
 * Get a human-readable label for content type
 */
const getContentTypeLabel = (contentType: ContentType): string => {
  const labels: Record<ContentType, string> = {
    bookmark: 'Bookmark',
    youtube: 'YouTube Video',
    youtube_short: 'YouTube Short',
    x: 'X/Twitter Post',
    github: 'GitHub Repository',
    instagram: 'Instagram Post',
    facebook: 'Facebook Post',
    threads: 'Threads Post',
    tiktok: 'TikTok Video',
    reddit: 'Reddit Post',
    amazon: 'Amazon Product',
    linkedin: 'LinkedIn Post',
    image: 'Image',
    pdf: 'PDF Document',
    video: 'Video',
    audio: 'Audio',
    podcast: 'Podcast Episode',
    note: 'Note',
    article: 'Article',
    product: 'Product',
    book: 'Book',
    course: 'Course',
    movie: 'Movie',
    tv_show: 'TV Show',
  };

  return labels[contentType] || contentType;
};

/**
 * Format context metadata for display in UI
 */
export const formatContextMetadata = (metadata: ContextMetadata): string => {
  const parts: string[] = [];

  parts.push(`${metadata.wordCount.toLocaleString()} words`);

  if (metadata.hasTranscript) {
    parts.push('with transcript');
  }

  const fieldLabels = metadata.includedFields
    .filter(field => !['content_type', 'title'].includes(field))
    .map(field => {
      const labels: Record<string, string> = {
        description: 'Description',
        url: 'URL',
        transcript: 'Transcript',
        content: 'Content',
        raw_text: 'Text',
        tags: 'Tags',
        author: 'Author',
        username: 'Username',
        domain: 'Domain',
        video_url: 'Video',
        image_urls: 'Images',
      };
      return labels[field] || field;
    });

  if (fieldLabels.length > 0) {
    parts.push(fieldLabels.join(', '));
  }

  return parts.join(' • ');
};
