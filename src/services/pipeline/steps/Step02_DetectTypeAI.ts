import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { classifyUrlWithAI } from '../../../services/aiUrlClassifier';

export const Step02_DetectTypeAI: Step = async ({ itemId, url }) => {
  console.log('🧠 [Step02_DetectTypeAI] Considering AI classification');
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (!item) return;

  // Skip if already classified (including notes)
  if (item.content_type !== 'bookmark') {
    console.log('🧠 [Step02_DetectTypeAI] Skipping AI - content_type already set:', item.content_type);
    return;
  }

  // Provide minimal context to improve AI accuracy
  let siteName: string | undefined;
  try {
    siteName = new URL(item.url || url).hostname.replace(/^www\./, '');
  } catch {}

  const classified = await classifyUrlWithAI(url, {
    pageTitle: item.title,
    pageDescription: item.desc || undefined,
    siteName,
  });

  if (classified && classified !== 'bookmark') {
    console.log('🧠 [Step02_DetectTypeAI] AI classified as:', classified);
    await itemsActions.updateItemWithSync(itemId, { content_type: classified });
  } else {
    console.log('🧠 [Step02_DetectTypeAI] AI returned no better classification');
  }
};


