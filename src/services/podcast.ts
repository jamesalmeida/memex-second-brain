/**
 * Podcast metadata extraction service
 * Extracts audio URL and episode information from podcast RSS feeds
 */

export interface PodcastEpisodeData {
  audioUrl?: string;
  title?: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  duration?: number;
  podcastTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  isEpisode: boolean; // true if URL points to a specific episode, false if podcast homepage
}

/**
 * Extract podcast episode data from a URL
 * Uses RSS feed parsing to find the audio file URL
 */
export const extractPodcastData = async (url: string, episodeTitle?: string): Promise<PodcastEpisodeData> => {
  try {
    console.log('🎙️ [Podcast] Extracting podcast data from:', url);
    if (episodeTitle) {
      console.log('🎙️ [Podcast] Episode title hint:', episodeTitle);
    }

    // Check if this is a specific episode URL or podcast homepage
    const isEpisodeUrl = isSpecificEpisode(url);

    if (!isEpisodeUrl) {
      console.log('🎙️ [Podcast] URL points to podcast homepage, not a specific episode');
      return {
        isEpisode: false,
      };
    }

    // Try platform-specific extractors
    if (url.includes('podcasts.apple.com')) {
      return await extractApplePodcast(url, episodeTitle);
    } else if (url.includes('spotify.com/episode')) {
      return await extractSpotifyPodcast(url);
    } else if (url.includes('overcast.fm')) {
      return await extractOvercastPodcast(url);
    } else {
      // Generic RSS feed parsing
      return await extractGenericPodcast(url);
    }
  } catch (error) {
    console.error('Error extracting podcast data:', error);
    return {
      isEpisode: false,
    };
  }
};

/**
 * Check if URL points to a specific episode or podcast homepage
 */
const isSpecificEpisode = (url: string): boolean => {
  // Apple Podcasts: episode URLs contain /id
  if (url.includes('podcasts.apple.com')) {
    return url.includes('?i=') || url.match(/\/id\d+\?i=\d+/) !== null;
  }

  // Spotify: episode URLs
  if (url.includes('spotify.com/episode/')) {
    return true;
  }

  // Overcast: episode URLs
  if (url.includes('overcast.fm') && !url.endsWith('/itunes')) {
    return true;
  }

  // Generic: if URL has path segments beyond the podcast identifier, likely an episode
  const pathSegments = new URL(url).pathname.split('/').filter(s => s.length > 0);
  return pathSegments.length > 2;
};

/**
 * Extract Apple Podcasts episode data
 */
const extractApplePodcast = async (url: string, episodeTitle?: string): Promise<PodcastEpisodeData> => {
  try {
    console.log('🍎 [Apple Podcasts] Extracting episode data');

    // Apple Podcasts doesn't directly expose audio URLs
    // We need to fetch the podcast's RSS feed
    // The episode URL format is: https://podcasts.apple.com/us/podcast/{podcast-name}/id{podcast-id}?i={episode-id}

    // Extract podcast ID and episode ID from URL
    const podcastIdMatch = url.match(/\/id(\d+)/);
    const episodeIdMatch = url.match(/\?i=(\d+)/);

    if (!podcastIdMatch || !episodeIdMatch) {
      console.log('🍎 [Apple Podcasts] Could not extract podcast/episode IDs from URL');
      return { isEpisode: false };
    }

    const podcastId = podcastIdMatch[1];
    const episodeId = episodeIdMatch[1];

    console.log('🍎 [Apple Podcasts] Podcast ID:', podcastId, 'Episode ID:', episodeId);

    // First, fetch episode-specific data from iTunes API
    const episodeLookupResponse = await fetch(`https://itunes.apple.com/lookup?id=${episodeId}`);
    const episodeLookupData = await episodeLookupResponse.json();

    let episodeGuid: string | undefined;
    let fallbackEpisodeData: Partial<PodcastEpisodeData> = {};

    if (episodeLookupData.results && episodeLookupData.results.length > 0) {
      const episodeInfo = episodeLookupData.results[0];
      episodeGuid = episodeInfo.episodeGuid;

      // Store fallback data from iTunes API
      fallbackEpisodeData = {
        title: episodeInfo.trackName,
        description: episodeInfo.description,
        audioUrl: episodeInfo.episodeUrl,
        publishedDate: episodeInfo.releaseDate,
        duration: episodeInfo.trackTimeMillis ? Math.floor(episodeInfo.trackTimeMillis / 1000) : undefined,
        podcastTitle: episodeInfo.collectionName,
      };

      console.log('🍎 [Apple Podcasts] Episode GUID from iTunes:', episodeGuid);
    }

    // Use iTunes API to get podcast feed URL
    const lookupResponse = await fetch(`https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`);
    const lookupData = await lookupResponse.json();

    if (!lookupData.results || lookupData.results.length === 0) {
      console.log('🍎 [Apple Podcasts] No podcast results from iTunes API');
      // If we have fallback data, use it
      if (fallbackEpisodeData.audioUrl) {
        console.log('🍎 [Apple Podcasts] Using iTunes API fallback data');
        return {
          ...fallbackEpisodeData,
          isEpisode: true,
        };
      }
      return { isEpisode: false };
    }

    const feedUrl = lookupData.results[0].feedUrl;
    if (!feedUrl) {
      console.log('🍎 [Apple Podcasts] No feed URL found');
      // If we have fallback data, use it
      if (fallbackEpisodeData.audioUrl) {
        console.log('🍎 [Apple Podcasts] Using iTunes API fallback data');
        return {
          ...fallbackEpisodeData,
          isEpisode: true,
        };
      }
      return { isEpisode: false };
    }

    console.log('🍎 [Apple Podcasts] Feed URL:', feedUrl);

    // Fetch and parse RSS feed
    const feedResponse = await fetch(feedUrl);
    const feedText = await feedResponse.text();

    // Try multiple matching strategies in order of reliability:
    // 1. Match by episode title (if provided from page metadata)
    // 2. Match by episodeGuid (from iTunes API)
    // 3. Match by episodeId (Apple's trackId - least reliable)
    let episodeData: Omit<PodcastEpisodeData, 'isEpisode'> | null = null;

    if (episodeTitle) {
      console.log('🍎 [Apple Podcasts] Trying to match by episode title:', episodeTitle);
      episodeData = parseRSSForEpisodeByTitle(feedText, episodeTitle);
      if (episodeData && episodeData.audioUrl) {
        console.log('🍎 [Apple Podcasts] Found episode by title match!');
      }
    }

    if (!episodeData && episodeGuid) {
      console.log('🍎 [Apple Podcasts] Trying to match by episode GUID:', episodeGuid);
      episodeData = parseRSSForEpisode(feedText, episodeGuid);
      if (episodeData && episodeData.audioUrl) {
        console.log('🍎 [Apple Podcasts] Found episode by GUID match!');
      }
    }

    if (!episodeData) {
      console.log('🍎 [Apple Podcasts] Trying to match by episode ID:', episodeId);
      episodeData = parseRSSForEpisode(feedText, episodeId);
      if (episodeData && episodeData.audioUrl) {
        console.log('🍎 [Apple Podcasts] Found episode by ID match!');
      }
    }

    if (episodeData && episodeData.audioUrl) {
      console.log('🍎 [Apple Podcasts] Found episode in RSS feed, audio URL:', episodeData.audioUrl);
      return {
        ...episodeData,
        isEpisode: true,
      };
    }

    // Fallback to iTunes API data if RSS parsing failed
    if (fallbackEpisodeData.audioUrl) {
      console.log('🍎 [Apple Podcasts] RSS parsing failed, using iTunes API fallback data');
      return {
        ...fallbackEpisodeData,
        isEpisode: true,
      };
    }

    console.log('🍎 [Apple Podcasts] Could not find episode in feed and no fallback data available');
    return { isEpisode: false };
  } catch (error) {
    console.error('Error extracting Apple Podcasts data:', error);
    return { isEpisode: false };
  }
};

/**
 * Extract Spotify Podcasts episode data
 */
const extractSpotifyPodcast = async (url: string): Promise<PodcastEpisodeData> => {
  console.log('🎵 [Spotify] Spotify podcasts require authentication - not supported yet');
  // Spotify requires OAuth authentication to access podcast data
  // For now, return isEpisode: true but no audio URL
  // Users can manually add the audio URL if they have it
  return {
    isEpisode: true,
  };
};

/**
 * Extract Overcast episode data
 */
const extractOvercastPodcast = async (url: string): Promise<PodcastEpisodeData> => {
  try {
    console.log('☁️ [Overcast] Extracting episode data');

    // Overcast URLs often redirect to the actual audio file
    // We can try to fetch the page and look for the audio element
    const response = await fetch(url);
    const html = await response.text();

    // Look for audio source in HTML
    const audioMatch = html.match(/<audio[^>]*src="([^"]+)"/);
    if (audioMatch && audioMatch[1]) {
      console.log('☁️ [Overcast] Found audio URL:', audioMatch[1]);
      return {
        audioUrl: audioMatch[1],
        isEpisode: true,
      };
    }

    // Try to find meta tags for episode info
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);

    return {
      audioUrl: undefined,
      title: titleMatch ? titleMatch[1] : undefined,
      description: descMatch ? descMatch[1] : undefined,
      isEpisode: true,
    };
  } catch (error) {
    console.error('Error extracting Overcast data:', error);
    return { isEpisode: false };
  }
};

/**
 * Extract generic podcast data from RSS feed
 */
const extractGenericPodcast = async (url: string): Promise<PodcastEpisodeData> => {
  try {
    console.log('📻 [Generic] Attempting to fetch as RSS feed');

    const response = await fetch(url);
    const text = await response.text();

    // Check if this is an RSS feed
    if (text.includes('<rss') || text.includes('<feed')) {
      // Parse the first episode from the feed
      const episodeData = parseRSSForFirstEpisode(text);
      if (episodeData) {
        return {
          ...episodeData,
          isEpisode: true,
        };
      }
    }

    return { isEpisode: false };
  } catch (error) {
    console.error('Error extracting generic podcast data:', error);
    return { isEpisode: false };
  }
};

/**
 * Parse RSS feed XML to find a specific episode by ID (GUID)
 */
const parseRSSForEpisode = (xml: string, episodeId: string): Omit<PodcastEpisodeData, 'isEpisode'> | null => {
  try {
    // Find all <item> elements
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      // Check if this item matches the episode ID
      const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/);
      if (guidMatch && guidMatch[1].includes(episodeId)) {
        // Found the matching episode
        return parseEpisodeFromItemXml(itemXml);
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing RSS for episode:', error);
    return null;
  }
};

/**
 * Parse RSS feed XML to find a specific episode by title
 * Useful for Apple Podcasts where we can extract the title from the webpage
 */
const parseRSSForEpisodeByTitle = (xml: string, episodeTitle: string): Omit<PodcastEpisodeData, 'isEpisode'> | null => {
  try {
    // Clean up the title for matching
    // Apple Podcasts page title format: "Episode Title - Podcast Name - Apple Podcasts"
    const cleanTitle = episodeTitle.split(' - ')[0].trim().toLowerCase();

    console.log('🔍 [RSS] Searching for episode with title:', cleanTitle);

    // Find all <item> elements
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      // Check if this item matches the episode title
      const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
      if (titleMatch) {
        const itemTitle = decodeHtml(titleMatch[1]).toLowerCase();

        // Try both exact match and partial match (in case of slight differences)
        if (itemTitle === cleanTitle || itemTitle.includes(cleanTitle) || cleanTitle.includes(itemTitle)) {
          console.log('🔍 [RSS] Found matching episode title:', titleMatch[1]);
          return parseEpisodeFromItemXml(itemXml);
        }
      }
    }

    console.log('🔍 [RSS] No episode found matching title:', cleanTitle);
    return null;
  } catch (error) {
    console.error('Error parsing RSS for episode by title:', error);
    return null;
  }
};

/**
 * Parse RSS feed XML to get the first episode
 */
const parseRSSForFirstEpisode = (xml: string): Omit<PodcastEpisodeData, 'isEpisode'> | null => {
  try {
    // Find first <item> element
    const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
    if (!itemMatch) {
      return null;
    }

    return parseEpisodeFromItemXml(itemMatch[1]);
  } catch (error) {
    console.error('Error parsing RSS for first episode:', error);
    return null;
  }
};

/**
 * Parse episode data from RSS item XML
 */
const parseEpisodeFromItemXml = (itemXml: string): Omit<PodcastEpisodeData, 'isEpisode'> => {
  // Extract audio URL (enclosure tag)
  const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"/);
  const audioUrl = enclosureMatch ? enclosureMatch[1] : undefined;

  // Extract title
  const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? decodeHtml(titleMatch[1]) : undefined;

  // Extract description
  const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
  const description = descMatch ? decodeHtml(descMatch[1]) : undefined;

  // Extract author
  const authorMatch = itemXml.match(/<itunes:author>(.*?)<\/itunes:author>/);
  const author = authorMatch ? decodeHtml(authorMatch[1]) : undefined;

  // Extract published date
  const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
  const publishedDate = pubDateMatch ? pubDateMatch[1] : undefined;

  // Extract duration (iTunes format: HH:MM:SS or seconds)
  const durationMatch = itemXml.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
  let duration: number | undefined;
  if (durationMatch) {
    const durationStr = durationMatch[1];
    if (durationStr.includes(':')) {
      // Format: HH:MM:SS or MM:SS
      const parts = durationStr.split(':').map(Number);
      if (parts.length === 3) {
        duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        duration = parts[0] * 60 + parts[1];
      }
    } else {
      // Format: seconds
      duration = parseInt(durationStr, 10);
    }
  }

  // Extract episode/season numbers
  const episodeMatch = itemXml.match(/<itunes:episode>(.*?)<\/itunes:episode>/);
  const episodeNumber = episodeMatch ? parseInt(episodeMatch[1], 10) : undefined;

  const seasonMatch = itemXml.match(/<itunes:season>(.*?)<\/itunes:season>/);
  const seasonNumber = seasonMatch ? parseInt(seasonMatch[1], 10) : undefined;

  return {
    audioUrl,
    title,
    description,
    author,
    publishedDate,
    duration,
    episodeNumber,
    seasonNumber,
  };
};

/**
 * Decode HTML entities in text
 */
const decodeHtml = (html: string): string => {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*>/g, ''); // Strip HTML tags
};
