import type { Step } from '../types';
import { parseUrlWithLinkedom } from '../../linkedomParser';
import { itemsActions } from '../../../stores/items';

export const Step01ParseLinkedom: Step = async ({ itemId, url }) => {
  console.log('🧰 [Step01ParseLinkedom] Parsing with linkedom');
  const parsed = await parseUrlWithLinkedom(url);
  await itemsActions.updateItemWithSync(itemId, {
    title: parsed.title,
    desc: parsed.description,
    thumbnail_url: parsed.image,
    content: parsed.html,
  });
};


