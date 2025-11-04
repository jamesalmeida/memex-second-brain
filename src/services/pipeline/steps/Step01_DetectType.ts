import type { Step } from '../types';
import type { ContentType } from '../../../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { isAmazonUrl } from '../../../utils/urlHelpers';

export const Step01_DetectType: Step = async ({ itemId, url }) => {
  console.log('🧭 [Step01_DetectType] Detecting content type');

  // STEP 1: Validate URL format
  let isValidUrl = false;
  try {
    new URL(url);
    isValidUrl = true;
  } catch {
    isValidUrl = false;
  }

  // STEP 2: Handle invalid URLs (convert to notes)
  if (!isValidUrl) {
    console.log('🧭 [Step01_DetectType] Not a valid URL - converting to note');
    await itemsActions.updateItemWithSync(itemId, {
      content_type: 'note',
      title: '',
      notes: url, // Save the text as note body
      url: undefined,
      thumbnail_url: undefined,
    });
    return; // Stop pipeline here
  }

  // STEP 3: Detect content type for valid URLs
  const lower = url.toLowerCase();
  let content_type: ContentType = 'bookmark';
  // YouTube detection: Match youtube.com (with any subdomain) or youtu.be
  if (/(youtube\.com|youtu\.be)/i.test(lower)) content_type = 'youtube';
  else if (/(twitter\.com|x\.com)/i.test(lower)) content_type = 'x';
  else if (/instagram\.com/i.test(lower)) content_type = 'instagram';
  else if (/(tiktok\.com|vm\.tiktok\.com)/i.test(lower)) content_type = 'tiktok';
  else if (/(reddit\.com|redd\.it)/i.test(lower)) content_type = 'reddit';
  else if (/ebay\.com/i.test(lower)) content_type = 'ebay';
  else if (/yelp\.com/i.test(lower)) content_type = 'yelp';
  else if (/apps\.apple\.com/i.test(lower)) content_type = 'app_store';
  else if (/(facebook\.com|fb\.com|fb\.watch)/i.test(lower)) content_type = 'facebook';
  else if (/imdb\.com\/title\//i.test(lower)) content_type = 'movie';
  else if (/(podcasts\.apple\.com|itunes\.apple\.com)/i.test(lower)) content_type = 'podcast';
  else if (/(spotify\.com\/episode|spotify\.com\/show)/i.test(lower)) content_type = 'podcast';
  else if (/overcast\.fm/i.test(lower)) content_type = 'podcast';
  else if (isAmazonUrl(url)) content_type = 'product';

  if (content_type !== 'bookmark') {
    await itemsActions.updateItemWithSync(itemId, { content_type });
    console.log('🧭 [Step01_DetectType] Set content_type =', content_type);
  } else {
    console.log('🧭 [Step01_DetectType] Defaulting content_type to bookmark');
  }
};

