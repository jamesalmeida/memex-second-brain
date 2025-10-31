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

  // AssemblyAI for X video transcription
  ASSEMBLYAI: {
    API_KEY: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || '',
    BASE_URL: 'https://api.assemblyai.com/v2',
  },

  // Instagram/Meta oEmbed API
  INSTAGRAM: {
    ACCESS_TOKEN: process.env.EXPO_PUBLIC_META_ACCESS_TOKEN || '',
    BASE_URL: 'https://graph.facebook.com/v22.0',
  },
  
  // SerpAPI (Account API and search endpoints)
  SERPAPI: {
    // Note: variable name per project setup
    API_KEY: process.env.EXPO_PUBLIC_SERPAI_API_KEY || '',
    BASE_URL: 'https://serpapi.com',
  },
};

// Helper to check if APIs are configured
export const isAPIConfigured = {
  jina: () => !!API_CONFIG.JINA_AI.API_KEY,
  twitter: () => !!API_CONFIG.TWITTER.BEARER_TOKEN,
  openai: () => !!API_CONFIG.OPENAI.API_KEY,
  assemblyai: () => !!API_CONFIG.ASSEMBLYAI.API_KEY,
  instagram: () => !!API_CONFIG.INSTAGRAM.ACCESS_TOKEN,
  serpapi: () => !!API_CONFIG.SERPAPI.API_KEY,
};