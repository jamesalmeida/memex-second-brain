import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';
import { serpapi } from '../../../services/serpapi';
import { adminSettingsComputed } from '../../../stores/adminSettings';
import { trackApiUsage } from '../../../services/apiUsageTracking';

export const Step04_1a_EnrichYouTube_SerpAPI: Step = async ({ itemId, url, preferences }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (!item || (item.content_type !== 'youtube' && item.content_type !== 'youtube_short')) return;
  const sourcePref = preferences?.youtubeSource || adminSettingsComputed.youtubeSource();
  if (sourcePref !== 'serpapi') return;

  console.log('🎬 [Step04_1a_EnrichYouTube_SerpAPI] Enriching YouTube via SerpAPI');
  const res = await serpapi.fetchYouTubeViaSerpApi(url);
  if ((res as any)?.error) {
    console.warn('[YouTube_SerpAPI] Skipping due to error:', (res as any).error);
    return;
  }

  // Track API usage for successful enrichment
  await trackApiUsage('serpapi', 'youtube_enrichment', itemId);

  // Map fields from youtube_video engine or fallback youtube search
  const video = ((): any => {
    if ((res as any)?.title) return res; // youtube_video engine likely returns flat object
    const fromSearch = (res as any)?.video_results?.[0] || (res as any)?.top_result || null;
    return fromSearch;
  })();
  if (!video) return;

  const thumbnail = video.thumbnails?.[0]?.url || video.thumbnail?.static || video.thumbnail?.rich || video.thumbnail || (video.thumbnail_url) || item.thumbnail_url;

  const normalizeDate = (value: any): string | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    // Strip common prefixes from YouTube/SerpAPI
    const cleaned = value.replace(/^Premiered\s+/i, '').replace(/^Streamed\s+/i, '');
    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return undefined;
    // Return YYYY-MM-DD for Postgres date type compatibility
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  await itemsActions.updateItemWithSync(itemId, {
    title: video.title || item.title,
    desc: video.description || video.snippet || item.desc,
    thumbnail_url: thumbnail,
  });

  await itemMetadataActions.upsertMetadata({
    item_id: itemId,
    author: video.channel?.name || video.channel?.title || video.author,
    published_date: normalizeDate(video.upload_date || video.date || video.published_date),
  });

  await itemTypeMetadataActions.upsertTypeMetadata({
    item_id: itemId,
    content_type: item.content_type,
    data: {
      video_id: (res as any)?.video_id,
      view_count: video.views || video.view_count || video.viewCount,
      duration: video.length || video.duration || video.length_text,
      channel_id: video.channel?.id,
      channel_name: video.channel?.name || video.channel?.title,
      channel_url: video.channel?.link || video.channel?.url,
      category: video.category,
      tags: video.keywords || video.tags,
      is_live: video.is_live || video.live_now,
      serpapi_enriched: true,
    },
  });

  // Auto-generate transcript if enabled (non-blocking)
  setTimeout(() => {
    itemsActions.autoGenerateYouTubeTranscript(itemId).catch(err => {
      console.error('Error auto-generating YouTube transcript:', err);
    });
  }, 100);
};


