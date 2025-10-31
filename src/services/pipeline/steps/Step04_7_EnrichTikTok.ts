import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { extractURLMetadata } from '../../../services/urlMetadata';

export const Step04_7_EnrichTikTok: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'tiktok') return;
  console.log('🎵 [Step04_7_EnrichTikTok] Enriching TikTok metadata');

  try {
    const metadata = await extractURLMetadata(url);
    if (!metadata) return;

    await itemsActions.updateItemWithSync(itemId, {
      title: metadata.title || item.title,
      desc: metadata.description || item.desc,
      thumbnail_url: metadata.image || item.thumbnail_url,
    });

    await itemMetadataActions.upsertMetadata({
      item_id: itemId,
      domain: metadata.siteName,
      author: metadata.author,
    });

    console.log('✅ [Step04_7_EnrichTikTok] TikTok metadata enriched successfully');
  } catch (error) {
    console.error('[Step04_7_EnrichTikTok] Error enriching TikTok metadata:', error);
  }
};
