import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { extractPodcastData } from '../../../services/podcast';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';

export const Step04_8_EnrichPodcast: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'podcast') return;

  console.log('🎙️ [Step04_8_EnrichPodcast] Enriching podcast from URL');

  try {
    const data = await extractPodcastData(url);

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
