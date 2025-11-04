import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { classifyUrlWithAI } from '../../../services/aiUrlClassifier';

export const Step02_DetectTypeAI: Step = async ({ itemId, url }) => {
  console.log('🧠 [Step02_DetectTypeAI] Considering AI classification');
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (!item) return;

  // Special handling for podcast URLs - use URL pattern to detect episodes
  if (item.content_type === 'podcast') {
    console.log('🧠 [Step02_DetectTypeAI] Podcast detected, checking URL pattern for episode');

    // Check URL patterns that indicate a specific episode
    const isEpisode =
      url.includes('?i=') ||                    // Apple Podcasts episode
      url.includes('/episode/') ||              // Spotify episode
      (url.includes('overcast.fm') && !url.endsWith('/itunes'));  // Overcast episode

    if (isEpisode) {
      console.log('🧠 [Step02_DetectTypeAI] URL pattern indicates podcast episode');
      await itemsActions.updateItemWithSync(itemId, {
        content_type: 'podcast_episode',
      });
    } else {
      console.log('🧠 [Step02_DetectTypeAI] URL pattern indicates podcast homepage');
      // Keep as 'podcast' type
    }
    return;
  }

  // Skip if already classified (including notes)
  if (item.content_type !== 'bookmark') {
    console.log('🧠 [Step02_DetectTypeAI] Skipping AI - content_type already set:', item.content_type);
    return;
  }

  // Provide minimal context to improve AI accuracy
  let siteName: string | undefined;
  try {
    siteName = new URL(item.url || url).hostname.replace(/^www\./, '');
  } catch {}

  const classified = await classifyUrlWithAI(url, {
    pageTitle: item.title,
    pageDescription: item.desc || undefined,
    siteName,
  });

  if (classified && classified !== 'bookmark') {
    console.log('🧠 [Step02_DetectTypeAI] AI classified as:', classified);
    await itemsActions.updateItemWithSync(itemId, { content_type: classified });
  } else {
    console.log('🧠 [Step02_DetectTypeAI] AI returned no better classification');
  }
};


