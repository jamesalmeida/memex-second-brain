export const AMAZON_SHORT_DOMAINS = new Set(['amzn.to', 'a.co']);

const AMAZON_HOST_PATTERN = /(^|\.)amazon\.[a-z.]+$/;

/**
 * Returns true when the URL clearly belongs to an Amazon storefront
 * or one of its affiliate short domains (amzn.to, a.co).
 */
export const isAmazonUrl = (rawUrl?: string | null): boolean => {
  if (!rawUrl) return false;

  const lower = rawUrl.toLowerCase();

  try {
    const { hostname } = new URL(lower);
    const cleanHost = hostname.replace(/^www\./, '');

    if (AMAZON_SHORT_DOMAINS.has(cleanHost)) return true;
    if (AMAZON_HOST_PATTERN.test(cleanHost)) return true;
  } catch {
    // Ignore parsing issues and fall back to substring checks below
  }

  return (
    AMAZON_HOST_PATTERN.test(lower.replace(/^[a-z]+:\/\//, '').split('/')[0] || '') ||
    lower.includes('amzn.to/') ||
    lower.includes('amzn.to?') ||
    lower.includes('a.co/')
  );
};

/**
 * Safely convert a possibly relative URL into an absolute one based on a page URL.
 */
export const resolveToAbsoluteUrl = (baseUrl: string, href: string | undefined): string | undefined => {
  try {
    if (!href) return undefined;
    if (href.startsWith('data:')) return href;
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

/**
 * Extract the YouTube video ID from the common watch/embed/short links.
 */
export const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/i,
    /youtube\.com\/embed\/([^&\n?#]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Extract the tweet/post ID from Twitter or X URLs (including /i/web/status variants).
 */
export const extractTweetId = (url: string): string | null => {
  const patterns = [
    /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/i,
    /(?:twitter\.com|x\.com)\/[^\/?#]+\/status\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Extract owner/repo params from a GitHub repo URL.
 */
export const extractGitHubRepo = (url: string): { owner: string; repo: string } | null => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
    };
  }
  return null;
};
