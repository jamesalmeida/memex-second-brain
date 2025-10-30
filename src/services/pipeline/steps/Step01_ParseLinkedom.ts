import type { Step } from '../types';
import { parseUrlWithLinkedom } from '../../linkedomParser';
import { itemsActions } from '../../../stores/items';

export const Step01_ParseLinkedom: Step = async ({ itemId, url }) => {
  console.log('🧰 [Step01_ParseLinkedom] Parsing with linkedom');
  const parsed = await parseUrlWithLinkedom(url);
  console.log('🧰 [Step01_ParseLinkedom] Parsed:', parsed);
  // If URL is invalid, convert item to a note and stop further parsing updates
  if (parsed.title === 'Invalid URL') {
    await itemsActions.updateItemWithSync(itemId, {
      content_type: 'note',
      title: '',
      desc: url, // Preserve original input text as the note body
      url: undefined,
      thumbnail_url: undefined,
      content: undefined,
    });
    return;
  }

  await itemsActions.updateItemWithSync(itemId, {
    title: parsed.title,
    desc: parsed.description,
    thumbnail_url: parsed.image,
    content: parsed.html,
  });
};


