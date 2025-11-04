import type { Step } from '../types';
import { itemsActions, itemsStore } from '../../../stores/items';
import { extractPodcastData } from '../../../services/podcast';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';
import { parseUrlWithLinkedom } from '../../linkedomParser';

export const Step04_8_EnrichPodcast: Step = async ({ itemId, url }) => {
  console.log('🎙️ [Step04_8_EnrichPodcast] Starting podcast enrichment');

  // Read item from local store (pipeline steps run sequentially with await,
  // so Step02/Step03 store updates will have completed before this step runs)
  const allItems = itemsStore.items.get();
  console.log('🎙️ [Step04_8_EnrichPodcast] Total items in store:', allItems.length);

  const item = allItems.find(i => i.id === itemId);
  if (!item) {
    console.error('🎙️ [Step04_8_EnrichPodcast] Item not found in store:', itemId);
    console.error('🎙️ [Step04_8_EnrichPodcast] Available item IDs:', allItems.map(i => i.id).slice(0, 5));
    return;
  }

  console.log('🎙️ [Step04_8_EnrichPodcast] Found item, content_type:', item.content_type);

  // Run for both 'podcast' and 'podcast_episode' types
  // (Need to check both due to potential race condition with store updates)
  if (item.content_type !== 'podcast' && item.content_type !== 'podcast_episode') {
    console.log('🎙️ [Step04_8_EnrichPodcast] Skipping - not a podcast, content_type:', item.content_type);
    return;
  }

  // Double-check URL pattern to ensure it's actually an episode
  const isEpisodeUrl =
    url.includes('?i=') ||                    // Apple Podcasts episode
    url.includes('/episode/') ||              // Spotify episode
    (url.includes('overcast.fm') && !url.endsWith('/itunes'));  // Overcast episode

  if (!isEpisodeUrl) {
    console.log('🎙️ [Step04_8_EnrichPodcast] URL pattern indicates homepage, extracting basic metadata');

    // Extract basic metadata for podcast homepage (title, description, artwork)
    try {
      const parsed = await parseUrlWithLinkedom(url);
      if (parsed.title && parsed.title !== 'Invalid URL') {
        console.log('🎙️ [Step04_8_EnrichPodcast] Fetched podcast homepage metadata');
        console.log('🎙️ [Step04_8_EnrichPodcast] Title:', parsed.title);
        console.log('🎙️ [Step04_8_EnrichPodcast] Description:', parsed.description ? 'Yes' : 'No');
        console.log('🎙️ [Step04_8_EnrichPodcast] Thumbnail:', parsed.image ? 'Yes' : 'No');

        // Update item with the fetched metadata
        await itemsActions.updateItemWithSync(itemId, {
          title: parsed.title,
          desc: parsed.description || undefined,
          thumbnail_url: parsed.image || undefined,
        });
      } else {
        console.log('🎙️ [Step04_8_EnrichPodcast] Failed to fetch metadata from homepage');
      }
    } catch (error) {
      console.error('🎙️ [Step04_8_EnrichPodcast] Error fetching homepage metadata:', error);
    }

    // Mark as non-episode
    await itemTypeMetadataActions.upsertTypeMetadata({
      item_id: itemId,
      content_type: 'podcast',
      data: {
        is_episode: false,
      },
    });

    return;
  }

  console.log('🎙️ [Step04_8_EnrichPodcast] URL pattern confirmed as episode');

  // If title is missing or generic (just the hostname), fetch it ourselves
  let episodeTitle = item.title;
  const isGenericTitle = !episodeTitle || episodeTitle === 'podcasts.apple.com' || episodeTitle === 'open.spotify.com' || episodeTitle.includes('://');

  if (isGenericTitle) {
    console.log('🎙️ [Step04_8_EnrichPodcast] Title is missing or generic, fetching from page...');
    try {
      const parsed = await parseUrlWithLinkedom(url);
      if (parsed.title && parsed.title !== 'Invalid URL') {
        episodeTitle = parsed.title;
        console.log('🎙️ [Step04_8_EnrichPodcast] Fetched episode title:', episodeTitle);
        console.log('🎙️ [Step04_8_EnrichPodcast] Fetched description:', parsed.description ? 'Yes' : 'No');
        console.log('🎙️ [Step04_8_EnrichPodcast] Fetched thumbnail:', parsed.image ? 'Yes' : 'No');
        // Update the item with the fetched metadata
        await itemsActions.updateItemWithSync(itemId, {
          title: episodeTitle,
          desc: parsed.description || undefined,
          thumbnail_url: parsed.image || undefined,
        });
      } else {
        console.log('🎙️ [Step04_8_EnrichPodcast] Failed to fetch title from page');
      }
    } catch (error) {
      console.error('🎙️ [Step04_8_EnrichPodcast] Error fetching title:', error);
    }
  }

  console.log('🎙️ [Step04_8_EnrichPodcast] Enriching podcast from URL');
  console.log('🎙️ [Step04_8_EnrichPodcast] Using episode title for matching:', episodeTitle || '(no title)');

  try {
    // Pass the episode title as a hint for RSS feed matching
    const data = await extractPodcastData(url, episodeTitle || undefined);

    // If not a specific episode, skip further enrichment
    if (!data.isEpisode) {
      console.log('🎙️ [Step04_8_EnrichPodcast] URL is podcast homepage, not enriching');
      // Store flag to indicate this is a homepage, not an episode
      await itemTypeMetadataActions.upsertTypeMetadata({
        item_id: itemId,
        content_type: 'podcast_episode',
        data: {
          is_episode: false,
        },
      });
      return;
    }

    // Update item with podcast episode data
    await itemsActions.updateItemWithSync(itemId, {
      title: data.title || item.title,
      desc: data.description || item.desc,
    });

    // Persist cross-type metadata (author, published date)
    await itemMetadataActions.upsertMetadata({
      item_id: itemId,
      author: data.author || undefined,
      published_date: data.publishedDate || undefined,
    });

    // Persist type-specific metadata (audio URL, duration, episode/season numbers)
    await itemTypeMetadataActions.upsertTypeMetadata({
      item_id: itemId,
      content_type: 'podcast_episode',
      data: {
        audio_url: data.audioUrl,
        duration: data.duration,
        episode_number: data.episodeNumber,
        season_number: data.seasonNumber,
        podcast_title: data.podcastTitle,
        is_episode: true,
      },
    });

    // Auto-generate transcript if audio URL is available and enabled (non-blocking)
    if (data.audioUrl) {
      setTimeout(() => {
        itemsActions.autoGeneratePodcastTranscript(itemId).catch(err => {
          console.error('Error auto-generating podcast transcript:', err);
        });
      }, 100);
    } else {
      console.log('🎙️ [Step04_8_EnrichPodcast] No audio URL found, skipping transcript generation');
    }
  } catch (error) {
    console.error('Error enriching podcast:', error);
  }
};
