import type { Step } from '../types';
import type { ContentType } from '../../../types';
import { itemsActions } from '../../../stores/items';

export const Step01DetectType: Step = async ({ itemId, url }) => {
  console.log('🧭 [Step01DetectType] Detecting content type');
  const lower = url.toLowerCase();
  let content_type: ContentType = 'bookmark';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) content_type = 'youtube';
  else if (lower.includes('twitter.com') || lower.includes('x.com')) content_type = 'x';

  if (content_type !== 'bookmark') {
    await itemsActions.updateItemWithSync(itemId, { content_type });
    console.log('🧭 [Step01DetectType] Set content_type =', content_type);
  } else {
    console.log('🧭 [Step01DetectType] Defaulting content_type to bookmark');
  }
};


