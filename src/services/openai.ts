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
};
