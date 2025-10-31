import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { extractURLMetadata } from '../../../services/urlMetadata';

export const Step04_5_EnrichAmazon: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'product') return;
  console.log('🛍️ [Step04_5_EnrichAmazon] Enriching Amazon product metadata');

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

    console.log('✅ [Step04_5_EnrichAmazon] Amazon product metadata enriched successfully');
  } catch (error) {
    console.error('[Step04_5_EnrichAmazon] Error enriching Amazon product:', error);
  }
};
