/**
 * Token estimation utilities for OpenAI models
 *
 * These are rough estimates based on empirical data:
 * - 1 token ≈ 0.75 words (English text)
 * - 1 token ≈ 4 characters
 *
 * For accurate counting, use tiktoken library, but these estimates
 * are sufficient for deciding which model to use based on context size.
 */

export interface TokenEstimate {
  estimatedTokens: number;
  wordCount: number;
  characterCount: number;
}

/**
 * Estimate token count from text content
 * Uses conservative estimate based on content characteristics
 */
export function estimateTokens(text: string | null | undefined): TokenEstimate {
  // Handle null/undefined content (e.g., tool call messages)
  if (!text) {
    return {
      estimatedTokens: 0,
      wordCount: 0,
      characterCount: 0,
    };
  }

  const characterCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  // Detect if this is likely a transcript or structured data
  // Transcripts and JSON/code tokenize much worse than natural language
  const hasTimestamps = /\[\d{1,2}:\d{2}:\d{2}\]|\d{1,2}:\d{2}/.test(text.substring(0, 1000));
  const hasRepeatedBrackets = (text.match(/\[/g) || []).length > wordCount * 0.01;
  const avgWordLength = characterCount / Math.max(wordCount, 1);
  const hasLongWords = avgWordLength > 8; // URLs, code, etc.
  const isPoorlyFormatted = text.includes('>>') || text.includes('[Music]') || text.includes('[Applause]');

  let tokensPerWord = 1.33; // Default for natural language

  // Adjust multiplier based on content type
  if (hasTimestamps || isPoorlyFormatted) {
    tokensPerWord = 6.0; // YouTube transcripts with timestamps/markers
  } else if (hasRepeatedBrackets || hasLongWords) {
    tokensPerWord = 3.0; // Structured data or code
  } else if (wordCount > 10000) {
    tokensPerWord = 2.0; // Very long content tends to tokenize worse
  }

  const estimatedTokens = Math.ceil(wordCount * tokensPerWord);

  return {
    estimatedTokens,
    wordCount,
    characterCount,
  };
}

/**
 * Estimate tokens for an array of chat messages
 */
export function estimateMessageTokens(messages: Array<{ role: string; content: string | null | undefined }>): TokenEstimate {
  // Each message has overhead for role, formatting, etc.
  const MESSAGE_OVERHEAD = 4; // tokens per message for formatting

  let totalWords = 0;
  let totalChars = 0;
  let totalTokens = 0;

  messages.forEach(msg => {
    const estimate = estimateTokens(msg.content);
    totalWords += estimate.wordCount;
    totalChars += estimate.characterCount;
    totalTokens += estimate.estimatedTokens + MESSAGE_OVERHEAD;
  });

  return {
    estimatedTokens: totalTokens,
    wordCount: totalWords,
    characterCount: totalChars,
  };
}

/**
 * Check if context size requires a larger model
 * Returns the recommended model based on token count
 */
export function getRecommendedModel(
  estimatedTokens: number,
  selectedModel: string
): {
  model: string;
  reason?: string;
  autoSwitched: boolean;
} {
  // Model context window limits (very conservative to account for:
  // 1. Estimation errors (our estimate could be off by 10-20%)
  // 2. Output tokens (we request up to 1500 tokens for response)
  // 3. System overhead and safety margin
  //
  // gpt-4o-mini has 128K context window, but in practice fails around 40K+ tokens
  // when you factor in response space and overhead
  const GPT_4O_MINI_SAFE_LIMIT = 30000; // Very conservative - switch early for large contexts

  // If tokens are within safe limit for gpt-4o-mini, use selected model
  if (estimatedTokens <= GPT_4O_MINI_SAFE_LIMIT) {
    return {
      model: selectedModel,
      autoSwitched: false,
    };
  }

  // If context is large, auto-switch to gpt-4.1-nano (1M context window)
  // It's faster and cheaper than gpt-4o-mini for large contexts
  return {
    model: 'gpt-4.1-nano-2025-04-14',
    reason: `Large context detected (${estimatedTokens.toLocaleString()} tokens). Auto-switched to GPT-4.1 nano with 1M token context window.`,
    autoSwitched: true,
  };
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens} tokens`;
  }
  return `${(tokens / 1000).toFixed(1)}K tokens`;
}
