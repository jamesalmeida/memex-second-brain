import { API } from '../constants';
import { estimateMessageTokens, getRecommendedModel } from '../utils/tokenEstimator';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionResult extends ChatCompletion {
  wasAutoSwitched?: boolean;
  autoSwitchReason?: string;
  requestedModel?: string;
}

// OpenAI Usage API types
export interface OpenAIUsageData {
  object: string;
  data: Array<{
    aggregation_timestamp: number;
    n_requests: number;
    operation: string;
    snapshot_id: string;
    n_context_tokens_total: number;
    n_generated_tokens_total: number;
  }>;
  ft_data?: any[];
  dalle_api_data?: any[];
  whisper_api_data?: any[];
  tts_api_data?: any[];
  current_usage_usd?: number;
}

export interface OpenAICostsData {
  object: string;
  data: Array<{
    timestamp: number;
    line_items: Array<{
      name: string;
      cost: number;
    }>;
  }>;
  has_more: boolean;
  next_page?: string;
}

export interface OpenAIRateLimits {
  requestsLimit?: number;
  requestsRemaining?: number;
  tokensLimit?: number;
  tokensRemaining?: number;
  resetRequests?: string;
  resetTokens?: string;
}

export interface OpenAIAccountStatus {
  isValid: boolean;
  error?: string;
  rateLimits?: OpenAIRateLimits;
  organizationId?: string;
  availableModelsCount?: number;
  lastChecked: number;
}

export interface OpenAIError {
  error: string;
}

// Tool-related types for function calling
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCompletionResult extends ChatCompletion {
  tool_calls?: ToolCall[];
  finish_reason?: string;
  wasAutoSwitched?: boolean;
  autoSwitchReason?: string;
}

// OpenAI API helpers
export const openai = {
  async createChatCompletion(
    messages: ChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
    } = {}
  ): Promise<ChatCompletion | null> {
    if (!API.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: options.model || 'gpt-3.5-turbo',
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1000,
        }),
      });

      if (!response.ok) {
        // Parse error response body for more details
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData, null, 2);
          console.error('OpenAI API error response:', errorData);
        } catch (parseError) {
          errorDetails = await response.text();
          console.error('OpenAI API error (raw):', errorDetails);
        }
        throw new Error(`OpenAI API error: ${response.status} - ${errorDetails}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return null;
    }
  },

  // Generate tags for content
  async generateTags(content: string, contentType: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates relevant tags for content. Return only a comma-separated list of tags, no other text.',
      },
      {
        role: 'user',
        content: `Generate 5-10 relevant tags for this ${contentType} content:\n\n${content.substring(0, 1000)}`,
      },
    ];

    const result = await this.createChatCompletion(messages, {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      max_tokens: 100,
    });

    if (result && result.choices[0]) {
      const tagsString = result.choices[0].message.content;
      return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    return [];
  },

  // Generate summary for transcripts or long content
  async summarizeContent(content: string, contentType: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that creates concise summaries. Keep summaries under 200 words.',
      },
      {
        role: 'user',
        content: `Please provide a concise summary of this ${contentType}:\n\n${content.substring(0, 2000)}`,
      },
    ];

    const result = await this.createChatCompletion(messages, {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      max_tokens: 300,
    });

    if (result && result.choices[0]) {
      return result.choices[0].message.content;
    }

    return 'Summary not available';
  },

  // Chat with item/space content as context
  async chatWithContext(
    context: string,
    userMessage: string,
    previousMessages: ChatMessage[] = []
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant with access to the following content as context. Use this context to provide accurate and relevant responses to user questions.\n\nContext:\n${context}`,
      },
      ...previousMessages,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const result = await this.createChatCompletion(messages, {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 1000,
    });

    if (result && result.choices[0]) {
      return result.choices[0].message.content;
    }

    return 'I apologize, but I could not generate a response at this time.';
  },

  // Enhanced chat with context that returns full completion data including metadata
  // Automatically switches to GPT-4.1-nano for large contexts (>100K tokens)
  async chatWithContextEnhanced(
    context: string,
    userMessage: string,
    previousMessages: ChatMessage[] = [],
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
    } = {}
  ): Promise<ChatCompletionResult | null> {
    // Add current timestamp to system message
    const now = new Date().toISOString();

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant with access to the following content as context. Use this context to provide accurate and relevant responses to user questions.\n\nCurrent Time: ${now}\n\nContext:\n${context}`,
      },
      ...previousMessages,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Debug logging: show what we're sending to OpenAI
    console.log('📨 Messages array being sent to OpenAI:');
    console.log(`  Total messages: ${messages.length}`);
    messages.forEach((msg, idx) => {
      const preview = msg.content.substring(0, 100).replace(/\n/g, ' ');
      console.log(`  [${idx}] ${msg.role}: ${msg.content.length.toLocaleString()} chars - "${preview}${msg.content.length > 100 ? '...' : ''}"`);
    });
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    console.log(`  📏 Total characters: ${totalChars.toLocaleString()}`);

    // Estimate total token count
    const tokenEstimate = estimateMessageTokens(messages);
    console.log(`📊 Estimated context size: ${tokenEstimate.estimatedTokens.toLocaleString()} tokens (${tokenEstimate.wordCount.toLocaleString()} words)`);

    // Get recommended model based on context size
    const requestedModel = options.model || 'gpt-4o-mini';
    const { model: selectedModel, reason, autoSwitched } = getRecommendedModel(
      tokenEstimate.estimatedTokens,
      requestedModel
    );

    if (autoSwitched) {
      console.log(`🔄 ${reason}`);
    }

    const result = await this.createChatCompletion(messages, {
      model: selectedModel,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 1500,
    });

    // Add auto-switch metadata to result
    if (result) {
      return {
        ...result,
        wasAutoSwitched: autoSwitched,
        autoSwitchReason: reason,
        requestedModel: autoSwitched ? requestedModel : undefined,
      };
    }

    return result;
  },

  // Describe an image using OpenAI Vision API
  async describeImage(
    imageUrl: string,
    options: {
      model?: string;
    } = {}
  ): Promise<string | null> {
    if (!API.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return null;
    }

    try {
      // Use a vision-capable model (gpt-4o or gpt-4o-mini)
      const model = options.model || 'gpt-4o-mini';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this image in extreme detail and precision. Your description will be used as context for another AI model that cannot see the image, so be thorough about all visible elements, text, colors, composition, mood, and any other relevant details. Focus on what is actually shown in the image.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.choices && data.choices[0]) {
        return data.choices[0].message.content;
      }

      return null;
    } catch (error) {
      console.error('OpenAI Vision API error:', error);
      return null;
    }
  },

  // Create chat completion with tools (function calling)
  async createChatCompletionWithTools(
    messages: ChatMessage[],
    tools: any[],
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    } = {}
  ): Promise<ToolCompletionResult | null> {
    if (!API.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return null;
    }

    try {
      // Estimate token count and auto-switch model if needed
      const tokenEstimate = estimateMessageTokens(messages);
      console.log(`📊 [Tools] Estimated context size: ${tokenEstimate.estimatedTokens.toLocaleString()} tokens`);

      const requestedModel = options.model || 'gpt-4o-mini';
      const { model: selectedModel, reason, autoSwitched } = getRecommendedModel(
        tokenEstimate.estimatedTokens,
        requestedModel
      );

      if (autoSwitched) {
        console.log(`🔄 [Tools] ${reason}`);
      }

      const requestBody: any = {
        model: selectedModel,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1500,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = options.tool_choice || 'auto';
      }

      console.log('[OpenAI] Sending request with tools:', tools.map(t => t.function.name).join(', '));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData, null, 2);
          console.error('OpenAI API error response:', errorData);
        } catch (parseError) {
          errorDetails = await response.text();
          console.error('OpenAI API error (raw):', errorDetails);
        }
        throw new Error(`OpenAI API error: ${response.status} - ${errorDetails}`);
      }

      const data = await response.json();

      // Extract tool calls if present
      const choice = data.choices?.[0];
      if (choice?.message?.tool_calls) {
        console.log('[OpenAI] Tool calls received:', choice.message.tool_calls.map((tc: any) => tc.function.name).join(', '));
        return {
          ...data,
          tool_calls: choice.message.tool_calls,
          finish_reason: choice.finish_reason,
          wasAutoSwitched: autoSwitched,
          autoSwitchReason: reason,
        };
      }

      return {
        ...data,
        wasAutoSwitched: autoSwitched,
        autoSwitchReason: reason,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      return null;
    }
  },

  // Fetch available models from OpenAI
  async fetchAvailableModels(): Promise<any[]> {
    if (!API.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return [];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      return [];
    }
  },

  // Extract rate limit information from response headers
  extractRateLimits(headers: Headers): OpenAIRateLimits {
    return {
      requestsLimit: headers.get('x-ratelimit-limit-requests')
        ? parseInt(headers.get('x-ratelimit-limit-requests')!)
        : undefined,
      requestsRemaining: headers.get('x-ratelimit-remaining-requests')
        ? parseInt(headers.get('x-ratelimit-remaining-requests')!)
        : undefined,
      tokensLimit: headers.get('x-ratelimit-limit-tokens')
        ? parseInt(headers.get('x-ratelimit-limit-tokens')!)
        : undefined,
      tokensRemaining: headers.get('x-ratelimit-remaining-tokens')
        ? parseInt(headers.get('x-ratelimit-remaining-tokens')!)
        : undefined,
      resetRequests: headers.get('x-ratelimit-reset-requests') || undefined,
      resetTokens: headers.get('x-ratelimit-reset-tokens') || undefined,
    };
  },

  // Fetch organization costs (daily breakdown)
  async fetchCosts(
    startDate?: Date,
    endDate?: Date,
    limit: number = 7
  ): Promise<OpenAICostsData | OpenAIError> {
    if (!API.OPENAI_API_KEY) {
      return { error: 'API key not configured' };
    }

    try {
      // Default to last 7 days if no dates provided
      const end = endDate || new Date();
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const startTime = Math.floor(start.getTime() / 1000);
      const endTime = Math.floor(end.getTime() / 1000);

      const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.error?.message || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error fetching OpenAI costs:', error);
      return { error: error.message || 'Failed to fetch costs' };
    }
  },

  // Fetch usage data
  async fetchUsage(
    startDate?: Date,
    endDate?: Date
  ): Promise<OpenAIUsageData | OpenAIError> {
    if (!API.OPENAI_API_KEY) {
      return { error: 'API key not configured' };
    }

    try {
      // Default to last 7 days if no dates provided
      const end = endDate || new Date();
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const startDateStr = start.toISOString().split('T')[0];
      const endDateStr = end.toISOString().split('T')[0];

      const url = `https://api.openai.com/v1/usage?date=${startDateStr}&date=${endDateStr}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.error?.message || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error fetching OpenAI usage:', error);
      return { error: error.message || 'Failed to fetch usage' };
    }
  },

  // Fetch account status (validates API key and gets rate limits)
  async fetchAccountStatus(): Promise<OpenAIAccountStatus> {
    if (!API.OPENAI_API_KEY) {
      return {
        isValid: false,
        error: 'API key not configured',
        lastChecked: Date.now(),
      };
    }

    try {
      // Make a minimal API call to check key validity and get rate limits
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API.OPENAI_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          isValid: false,
          error: errorData.error?.message || `HTTP ${response.status}`,
          lastChecked: Date.now(),
        };
      }

      const data = await response.json();
      const rateLimits = this.extractRateLimits(response.headers);

      // Try to get organization ID from headers
      const organizationId = response.headers.get('openai-organization') || undefined;

      return {
        isValid: true,
        rateLimits,
        organizationId,
        availableModelsCount: data.data?.length || 0,
        lastChecked: Date.now(),
      };
    } catch (error: any) {
      console.error('Error fetching OpenAI account status:', error);
      return {
        isValid: false,
        error: error.message || 'Failed to fetch account status',
        lastChecked: Date.now(),
      };
    }
  },
};
