import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { extractTweetId, fetchTweetData } from '../../../services/twitter';

export const Step03bEnrichX: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'x') return;
  console.log('🧵 [Step03bEnrichX] Enriching from X API');
  const id = extractTweetId(url);
  if (!id) return;
  const tweet = await fetchTweetData(id);

  const firstImage = tweet.media?.find(m => m.type === 'photo')?.url;
  const title = `@${tweet.author.username}: ${tweet.text.slice(0, 50)}${tweet.text.length > 50 ? '...' : ''}`;

  await itemsActions.updateItemWithSync(itemId, {
    title: title || item.title,
    desc: tweet.text || item.desc,
    thumbnail_url: firstImage || item.thumbnail_url,
  });
};


