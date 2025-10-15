import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { extractYouTubeData } from '../../../services/youtube';

export const Step03EnrichYouTube: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'youtube' && item?.content_type !== 'youtube_short') return;
  console.log('🎬 [Step03EnrichYouTube] Enriching from YouTube API');
  const data = await extractYouTubeData(url);
  await itemsActions.updateItemWithSync(itemId, {
    title: data.title || item.title,
    desc: data.description || item.desc,
    thumbnail_url: data.thumbnail || item.thumbnail_url,
    content_type: data.isShort ? 'youtube_short' : 'youtube',
  });
};


