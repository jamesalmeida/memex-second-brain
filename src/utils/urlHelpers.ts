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
