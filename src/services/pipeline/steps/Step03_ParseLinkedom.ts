import type { Step } from '../types';
import { parseUrlWithLinkedom } from '../../linkedomParser';
import { itemsStore, itemsActions } from '../../../stores/items';

export const Step03_ParseLinkedom: Step = async ({ itemId, url }) => {
  console.log('🧰 [Step03_ParseLinkedom] Checking if linkedom fallback needed');

  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (!item) return;

  // Skip if content_type has a specialized enricher (Step04)
  const hasEnricher = ['youtube', 'x', 'reddit', 'ebay', 'yelp', 'app_store', 'product', 'movie', 'tv_show', 'tiktok', 'note'].includes(item.content_type);
  if (hasEnricher) {
    console.log('🧰 [Step03_ParseLinkedom] Skipping - content_type has specialized handler');
    return;
  }

  // Skip if metadata already populated
  if (item.title && item.desc) {
    console.log('🧰 [Step03_ParseLinkedom] Skipping - metadata already populated');
    return;
  }

  console.log('🧰 [Step03_ParseLinkedom] Running linkedom fallback for generic bookmark');
  const parsed = await parseUrlWithLinkedom(url);

  // If linkedom fails, just skip (don't convert to note anymore - that's handled in Step01)
  if (parsed.title === 'Invalid URL') {
    console.log('🧰 [Step03_ParseLinkedom] Linkedom failed - keeping as bookmark with minimal data');
    return;
  }

  await itemsActions.updateItemWithSync(itemId, {
    title: parsed.title,
    desc: parsed.description,
    thumbnail_url: parsed.image,
    content: parsed.html,
  });
};


