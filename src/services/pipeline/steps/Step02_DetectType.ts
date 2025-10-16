import type { Step } from '../types';
import type { ContentType } from '../../../types';
import { itemsStore, itemsActions } from '../../../stores/items';

export const Step02_DetectType: Step = async ({ itemId, url }) => {
  console.log('🧭 [Step02_DetectType] Detecting content type');
  // If content_type was already set by a previous step (e.g., converted to 'note'), do nothing
  const existing = itemsStore.items.get().find(i => i.id === itemId);
  if (existing && existing.content_type !== 'bookmark') {
    console.log('🧭 [Step02_DetectType] Skipping - content_type already set to', existing.content_type);
    return;
  }
  const lower = url.toLowerCase();
  let content_type: ContentType = 'bookmark';
  if (/youtube\.com|youtu\.be/i.test(lower)) content_type = 'youtube';
  else if (/twitter\.com|x\.com/i.test(lower)) content_type = 'x';
  else if (/instagram\.com/i.test(lower)) content_type = 'instagram';
  else if (/tiktok\.com|vm\.tiktok\.com/i.test(lower)) content_type = 'tiktok';
  else if (/reddit\.com|redd\.it/i.test(lower)) content_type = 'reddit';
  else if (/facebook\.com|fb\.com|fb\.watch/i.test(lower)) content_type = 'facebook';
  else if (/imdb\.com\/title\//i.test(lower)) content_type = 'movie';
  else if (/amazon\./i.test(lower)) content_type = 'product';

  if (content_type !== 'bookmark') {
    await itemsActions.updateItemWithSync(itemId, { content_type });
    console.log('🧭 [Step02_DetectType] Set content_type =', content_type);
  } else {
    console.log('🧭 [Step02_DetectType] Defaulting content_type to bookmark');
  }
};


