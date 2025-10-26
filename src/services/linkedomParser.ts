import { API_CONFIG } from '../config/api';
import { resolveToAbsoluteUrl } from '../utils/urlHelpers';

// Lightweight client-side HTML parsing using linkedom
// Extracts: title, description, lead image, full HTML, and siteName
export interface ParsedPage {
  title: string;
  description?: string;
  image?: string;
  html: string;
  siteName?: string;
}

export async function parseUrlWithLinkedom(url: string): Promise<ParsedPage> {
  // Basic validation
  try {
    new URL(url);
  } catch {
    return { title: 'Invalid URL', html: '', description: undefined, image: undefined, siteName: undefined };
  }

  // Fetch HTML. On mobile, CORS is not enforced like web, but sites may block with UA checks.
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const htmlText = await response.text();

  // Dynamic import to avoid impacting bundle startup
  const linkedom = await import('linkedom');
  const { document } = linkedom.parseHTML(htmlText);

  const getMeta = (selector: string): string | undefined => document.querySelector(selector)?.getAttribute('content') || undefined;

  const rawTitle = getMeta('meta[property="og:title"]')
    || getMeta('meta[name="twitter:title"]')
    || document.title
    || '';

  const description = getMeta('meta[property="og:description"]')
    || getMeta('meta[name="description"]')
    || getMeta('meta[name="twitter:description"]')
    || undefined;

  const rawImage = getMeta('meta[property="og:image"]')
    || getMeta('meta[name="twitter:image"]')
    || undefined;
  const image = resolveToAbsoluteUrl(url, rawImage);

  const siteName = getMeta('meta[property="og:site_name"]')
    || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return undefined; } })();

  // Return full HTML for offline purposes
  const fullHTML = document.documentElement?.outerHTML || htmlText;

  const title = rawTitle && rawTitle.trim().length > 0
    ? rawTitle
    : (siteName || 'No title');

  return { title, description, image, html: fullHTML, siteName };
}

