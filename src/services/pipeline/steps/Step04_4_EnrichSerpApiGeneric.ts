import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';
import { serpapi } from '../../../services/serpapi';

export const Step04_4_EnrichSerpApiGeneric: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (!item) return;

  const hostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();

  let res: any = null;
  let type: 'ebay' | 'yelp' | 'app_store' | null = null;

  if (item.content_type === 'ebay' || /ebay\.com$/i.test(hostname)) {
    type = 'ebay';
    res = await serpapi.fetchEbayProduct(url);
  } else if (item.content_type === 'yelp' || /yelp\.com$/i.test(hostname)) {
    type = 'yelp';
    res = await serpapi.fetchYelpBusiness(url);
  } else if (item.content_type === 'app_store' || /apps\.apple\.com$/i.test(hostname)) {
    type = 'app_store';
    res = await serpapi.fetchAppleAppStore(url);
  }

  if (!type || !res || (res as any)?.error) {
    if ((res as any)?.error) console.warn('[SerpAPI Generic] Error:', (res as any).error);
    return;
  }

  // Normalize minimal fields across engines
  const title = (res as any)?.title || (res as any)?.product_title || (res as any)?.app_title || (res as any)?.business?.name;
  const description = (res as any)?.description || (res as any)?.snippet || (res as any)?.product_highlights?.[0];
  const thumbnail = (res as any)?.thumbnail || (res as any)?.image || (res as any)?.icon || (res as any)?.business?.image_url;

  await itemsActions.updateItemWithSync(itemId, {
    title: title || item.title,
    desc: description || item.desc,
    thumbnail_url: thumbnail || item.thumbnail_url,
  });

  await itemMetadataActions.upsertMetadata({
    item_id: itemId,
    author: (res as any)?.seller || (res as any)?.developer || (res as any)?.business?.name,
    published_date: undefined,
  });

  await itemTypeMetadataActions.upsertTypeMetadata({
    item_id: itemId,
    content_type: type,
    data: (res as any),
  });
};


