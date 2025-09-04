// API Configuration
// Store your API keys in environment variables or secure storage
// Never commit actual API keys to version control

export const API_CONFIG = {
  // Jina.ai for general URL scraping
  JINA_AI: {
    API_KEY: process.env.EXPO_PUBLIC_JINA_AI_API_KEY || '',
    BASE_URL: 'https://r.jina.ai',
  },
  
  // Twitter/X API
  TWITTER: {
    API_KEY: process.env.EXPO_PUBLIC_X_API_KEY || '',
    API_SECRET: process.env.EXPO_PUBLIC_X_API_KEY_SECRET || '',
    BEARER_TOKEN: process.env.EXPO_PUBLIC_X_BEARER_TOKEN || '',
    ACCESS_TOKEN: process.env.EXPO_PUBLIC_X_ACCESS_TOKEN || '',
    ACCESS_TOKEN_SECRET: process.env.EXPO_PUBLIC_X_ACCESS_TOKEN_SECRET || '',
    BASE_URL: 'https://api.twitter.com/2',
  },
  
  // OpenAI for tag generation
  OPENAI: {
    API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
    BASE_URL: 'https://api.openai.com/v1',
    MODEL: 'gpt-3.5-turbo',
  },
  
  // YouTube (using youtubei.js - no API key needed)
  YOUTUBE: {
    // youtubei.js handles authentication internally
  },
};

// Helper to check if APIs are configured
export const isAPIConfigured = {
  jina: () => !!API_CONFIG.JINA_AI.API_KEY,
  twitter: () => !!API_CONFIG.TWITTER.BEARER_TOKEN,
  openai: () => !!API_CONFIG.OPENAI.API_KEY,
};