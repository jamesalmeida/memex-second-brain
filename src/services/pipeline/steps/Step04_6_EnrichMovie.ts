import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { extractURLMetadata } from '../../../services/urlMetadata';

export const Step04_6_EnrichMovie: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'movie' && item?.content_type !== 'tv_show') return;
  console.log('🎬 [Step04_6_EnrichMovie] Enriching movie/TV metadata');

  try {
    const metadata = await extractURLMetadata(url);
    if (!metadata) return;

    // Update content_type if it was refined (e.g., movie -> tv_show)
    const updates: any = {
      title: metadata.title || item.title,
      desc: metadata.description || item.desc,
      thumbnail_url: metadata.image || item.thumbnail_url,
    };

    // Update content_type if it changed (IMDb can detect TV shows vs movies)
    if (metadata.contentType && metadata.contentType !== item.content_type) {
      updates.content_type = metadata.contentType;
    }

    await itemsActions.updateItemWithSync(itemId, updates);

    await itemMetadataActions.upsertMetadata({
      item_id: itemId,
      domain: metadata.siteName,
      author: metadata.author,
    });

    console.log('✅ [Step04_6_EnrichMovie] Movie/TV metadata enriched successfully');
  } catch (error) {
    console.error('[Step04_6_EnrichMovie] Error enriching movie/TV metadata:', error);
  }
};
