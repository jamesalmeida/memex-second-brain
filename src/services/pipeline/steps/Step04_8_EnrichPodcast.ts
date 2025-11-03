import type { Step } from '../types';
import { itemsActions, itemsStore } from '../../../stores/items';
import { extractPodcastData } from '../../../services/podcast';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';

export const Step04_8_EnrichPodcast: Step = async ({ itemId, url }) => {
  console.log('🎙️ [Step04_8_EnrichPodcast] Starting podcast enrichment');

  // Read item from local store (pipeline steps run sequentially with await,
  // so Step02's store update will have completed before this step runs)
  const allItems = itemsStore.items.get();
  console.log('🎙️ [Step04_8_EnrichPodcast] Total items in store:', allItems.length);

  const item = allItems.find(i => i.id === itemId);
  if (!item) {
    console.error('🎙️ [Step04_8_EnrichPodcast] Item not found in store:', itemId);
    console.error('🎙️ [Step04_8_EnrichPodcast] Available item IDs:', allItems.map(i => i.id).slice(0, 5));
    return;
  }

  console.log('🎙️ [Step04_8_EnrichPodcast] Found item, content_type:', item.content_type);

  if (item.content_type !== 'podcast') {
    console.log('🎙️ [Step04_8_EnrichPodcast] Skipping - not a podcast, content_type:', item.content_type);
    return;
  }

  console.log('🎙️ [Step04_8_EnrichPodcast] Enriching podcast from URL');
  console.log('🎙️ [Step04_8_EnrichPodcast] Item title:', item.title || '(no title)');

  try {
    // Pass the item's title as a hint for episode matching
    const data = await extractPodcastData(url, item.title || undefined);

    // If not a specific episode, skip further enrichment
    if (!data.isEpisode) {
      console.log('🎙️ [Step04_8_EnrichPodcast] URL is podcast homepage, not enriching');
      // Store flag to indicate this is a homepage, not an episode
      await itemTypeMetadataActions.upsertTypeMetadata({
        item_id: itemId,
        content_type: 'podcast',
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
      content_type: 'podcast',
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
