import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface MetadataRequest {
  url: string;
  contentType?: string;
}

interface MetadataResponse {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  domain?: string;
  author?: string;
  published_date?: string;
  content_type?: string;
  error?: string;
}

serve(async (req) => {
  try {
    const { url, contentType }: MetadataRequest = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const metadata = await extractMetadata(url, contentType);

    return new Response(
      JSON.stringify(metadata),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in extract-metadata:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function extractMetadata(url: string, providedContentType?: string): Promise<MetadataResponse> {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Detect content type if not provided
    const contentType = providedContentType || detectContentType(url);

    let metadata: MetadataResponse = {
      domain,
      content_type: contentType,
    };

    // Extract metadata based on content type
    switch (contentType) {
      case 'youtube':
        metadata = { ...metadata, ...(await extractYouTubeMetadata(url)) };
        break;
      case 'x':
      case 'twitter':
        metadata = { ...metadata, ...(await extractTwitterMetadata(url)) };
        break;
      case 'github':
        metadata = { ...metadata, ...(await extractGitHubMetadata(url)) };
        break;
      default:
        metadata = { ...metadata, ...(await extractGenericMetadata(url)) };
    }

    return metadata;
  } catch (error) {
    console.error("Error extracting metadata:", error);
    return { error: "Failed to extract metadata" };
  }
}

function detectContentType(url: string): string {
  const patterns = {
    youtube: /(?:youtube\.com\/watch\?|youtu\.be\/)/,
    twitter: /(?:twitter\.com|x\.com)\/.*\/status\//,
    github: /github\.com\/[^\/]+\/[^\/]+/,
    linkedin: /linkedin\.com\/.*\/posts\//,
    instagram: /instagram\.com\/p\//,
    tiktok: /tiktok\.com\/@.*\/video\//,
    reddit: /reddit\.com\/r\/.*\/comments\//,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(url)) {
      return type;
    }
  }

  return 'bookmark';
}

async function extractGenericMetadata(url: string): Promise<Partial<MetadataResponse>> {
  try {
    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MemexBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract basic metadata
    const title = extractTitle(html);
    const description = extractDescription(html);
    const thumbnail = extractThumbnail(html);

    return {
      title,
      description,
      thumbnail_url: thumbnail,
    };
  } catch (error) {
    console.error("Error fetching generic metadata:", error);
    return {
      title: url, // Fallback to URL
    };
  }
}

async function extractYouTubeMetadata(url: string): Promise<Partial<MetadataResponse>> {
  try {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return {};

    // You could integrate with YouTube Data API v3 here
    // For now, return basic info
    return {
      title: `YouTube Video ${videoId}`,
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  } catch (error) {
    console.error("Error extracting YouTube metadata:", error);
    return {};
  }
}

async function extractTwitterMetadata(url: string): Promise<Partial<MetadataResponse>> {
  try {
    // Extract tweet ID and basic info
    const tweetId = extractTweetId(url);
    if (!tweetId) return {};

    return {
      title: `Tweet ${tweetId}`,
    };
  } catch (error) {
    console.error("Error extracting Twitter metadata:", error);
    return {};
  }
}

async function extractGitHubMetadata(url: string): Promise<Partial<MetadataResponse>> {
  try {
    const repo = extractGitHubRepo(url);
    if (!repo) return {};

    return {
      title: `${repo.owner}/${repo.repo}`,
      description: `GitHub repository: ${repo.owner}/${repo.repo}`,
    };
  } catch (error) {
    console.error("Error extracting GitHub metadata:", error);
    return {};
  }
}

// Helper functions
function extractTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : undefined;
}

function extractDescription(html: string): string | undefined {
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return descMatch ? descMatch[1].trim() : undefined;
}

function extractThumbnail(html: string): string | undefined {
  // Try Open Graph image first
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (ogImageMatch) return ogImageMatch[1];

  // Try Twitter card image
  const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (twitterImageMatch) return twitterImageMatch[1];

  return undefined;
}

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

function extractGitHubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
    };
  }
  return null;
}