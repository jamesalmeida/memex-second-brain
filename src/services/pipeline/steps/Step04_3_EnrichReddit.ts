import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { itemMetadataActions } from '../../../stores/itemMetadata';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';
import { fetchRedditPostData } from '../../../services/reddit';

export const Step04_3_EnrichReddit: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'reddit') return;
  console.log('🧶 [Step04_3_EnrichReddit] Enriching from Reddit JSON API');

  const data = await fetchRedditPostData(url);
  if (!data) return;

  const desc = data.selftext
    ? `r/${data.subreddit}: ${data.selftext.slice(0, 400)}`
    : `r/${data.subreddit}`;

  await itemsActions.updateItemWithSync(itemId, {
    title: data.title || item.title,
    desc,
    thumbnail_url: data.thumbnail || data.images?.[0] || item.thumbnail_url,
  });

  await itemMetadataActions.upsertMetadata({
    item_id: itemId,
    author: data.author ? `u/${data.author}` : undefined,
    published_date: new Date(data.created_utc * 1000).toISOString(),
  });

  await itemTypeMetadataActions.upsertTypeMetadata({
    item_id: itemId,
    content_type: 'reddit',
    data: {
      video_url: data.videoUrl,
      image_urls: data.images,
      ups: data.ups,
      num_comments: data.num_comments,
      upvote_ratio: data.upvote_ratio,
      link_flair_text: data.link_flair_text,
      link_flair_background_color: data.link_flair_background_color,
      link_flair_text_color: data.link_flair_text_color,
      video_duration: data.video_duration,
      spoiler: data.spoiler,
      over_18: data.over_18,
      locked: data.locked,
      stickied: data.stickied,
      total_awards_received: data.total_awards_received,
      num_crossposts: data.num_crossposts,
      raw_json: data.raw_json,
      permalink: data.permalink,
      subreddit: data.subreddit,
      author: data.author,
    },
  });
};


