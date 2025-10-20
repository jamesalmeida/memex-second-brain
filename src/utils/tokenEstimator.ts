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
 * Uses conservative estimate of 1.33 tokens per word
 */
export function estimateTokens(text: string): TokenEstimate {
  const characterCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  // Conservative estimate: 1.33 tokens per word
  const estimatedTokens = Math.ceil(wordCount * 1.33);

  return {
    estimatedTokens,
    wordCount,
    characterCount,
  };
}

/**
 * Estimate tokens for an array of chat messages
 */
export function estimateMessageTokens(messages: Array<{ role: string; content: string }>): TokenEstimate {
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
