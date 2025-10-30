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

  async search(params: Record<string, string>): Promise<any | SerpApiError> {
    const apiKey = API_CONFIG.SERPAPI.API_KEY;
    if (!apiKey) return { error: 'SerpAPI key not configured' };
    const url = `${API_CONFIG.SERPAPI.BASE_URL}/search.json?` +
      Object.entries({ ...params, api_key: apiKey })
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) return { error: data?.error || `HTTP ${res.status}` };
      return data;
    } catch (e: any) {
      return { error: e?.message || 'Network error' };
    }
  },

  async fetchYouTubeViaSerpApi(url: string): Promise<any | SerpApiError> {
    const extractId = (u: string): string | null => {
      try {
        const clean = u.split('#')[0];
        const patterns = [
          /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
          /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
          /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
          /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
          /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        ];
        for (const p of patterns) {
          const m = clean.match(p);
          if (m) return m[1];
        }
        const urlObj = new URL(u);
        const v = urlObj.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
        return null;
      } catch {
        return null;
      }
    };

    const videoId = extractId(url);
    if (videoId) {
      // Dedicated engine for exact video details (expects `v` param)
      const res = await this.search({ engine: 'youtube_video', v: videoId });
      if ((res as any)?.error) return res as any;
      // Attach video_id so callers can use it
      if (res && typeof res === 'object') (res as any).video_id = videoId;
      return res;
    }
    // Fallback: general youtube search with the URL as query (best-effort)
    return this.search({ engine: 'youtube', search_query: url });
  },

  async fetchEbayProduct(url: string): Promise<any | SerpApiError> {
    // eBay engine supports query by product URL or keywords; try with url as query
    return this.search({ engine: 'ebay', query: url });
  },

  async fetchAppleAppStore(url: string): Promise<any | SerpApiError> {
    return this.search({ engine: 'apple_app_store', url });
  },

  async fetchYelpBusiness(url: string): Promise<any | SerpApiError> {
    return this.search({ engine: 'yelp', url });
  },
};


