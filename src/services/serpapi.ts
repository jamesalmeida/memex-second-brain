import { API_CONFIG } from '../config/api';

export interface SerpApiAccount {
  account_id?: string;
  email?: string;
  plan_name?: string;
  this_month_usage?: number;
  this_month_limit?: number | null;
  this_month_left?: number | null;
  hourly_search_limit?: number | null;
  credits_left?: number | null;
  api_key?: string;
}

export interface SerpApiError {
  error: string;
}

export const serpapi = {
  async fetchAccount(): Promise<SerpApiAccount | SerpApiError> {
    const apiKey = API_CONFIG.SERPAPI.API_KEY;
    if (!apiKey) {
      return { error: 'SerpAPI key not configured' };
    }

    const url = `${API_CONFIG.SERPAPI.BASE_URL}/account.json?api_key=${encodeURIComponent(apiKey)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const text = await response.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        return { error: 'Invalid JSON from SerpAPI' };
      }

      if (!response.ok) {
        const message = data?.error || `HTTP ${response.status}`;
        return { error: `SerpAPI error: ${message}` };
      }

      return data as SerpApiAccount;
    } catch (err: any) {
      return { error: err?.message || 'Network error calling SerpAPI' };
    }
  },
};


