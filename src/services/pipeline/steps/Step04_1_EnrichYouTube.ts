import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { extractYouTubeData } from '../../../services/youtube';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';
import { itemTypeMetadataComputed } from '../../../stores/itemTypeMetadata';
import { adminPrefsStore } from '../../../stores/adminPrefs';

export const Step04_1_EnrichYouTube: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'youtube' && item?.content_type !== 'youtube_short') return;
  // If admin preference is SerpAPI and SerpAPI step enriched, skip youtubei fallback
  if (adminPrefsStore.youtubeSource.get() === 'serpapi') {
    const md = itemTypeMetadataComputed.getTypeMetadataForItem(itemId);
    if (md && (md.data as any)?.serpapi_enriched) return;
  }
  console.log('🎬 [Step04_1_EnrichYouTube] Enriching from YouTube API');
  const data = await extractYouTubeData(url);
  await itemsActions.updateItemWithSync(itemId, {
    title: data.title || item.title,
    desc: data.description || item.desc,
    thumbnail_url: data.thumbnail || item.thumbnail_url,
    content_type: data.isShort ? 'youtube_short' : 'youtube',
    // optional: mirror original posted date into items if column exists
    // @ts-ignore
    posted_at: (data as any).publishedAt || undefined,
  });

  // Persist cross-type metadata (author, published date)
  await itemMetadataActions.upsertMetadata({
    item_id: itemId,
    author: data.author || undefined,
    published_date: (data as any).publishedAt || undefined,
  });

  // Persist type-specific metadata (video id, duration, view count)
  await itemTypeMetadataActions.upsertTypeMetadata({
    item_id: itemId,
    content_type: data.isShort ? 'youtube_short' : 'youtube',
    data: {
      video_id: data.videoId,
      duration: data.duration,
      view_count: data.viewCount,
      channel_id: (data as any).channelId,
      channel_name: (data as any).channelName,
      channel_url: (data as any).channelUrl,
      category: (data as any).category,
      tags: (data as any).tags,
      is_live: (data as any).isLive,
      is_live_content: (data as any).isLiveContent,
    },
  });

  // Auto-generate transcript if enabled (non-blocking)
  setTimeout(() => {
    itemsActions.autoGenerateYouTubeTranscript(itemId).catch(err => {
      console.error('Error auto-generating YouTube transcript:', err);
    });
  }, 100);
};


