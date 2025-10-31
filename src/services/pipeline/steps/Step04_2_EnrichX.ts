import type { Step } from '../types';
import { itemsStore, itemsActions } from '../../../stores/items';
import { extractTweetId, fetchTweetData } from '../../../services/twitter';
import { itemTypeMetadataActions } from '../../../stores/itemTypeMetadata';
import { itemMetadataActions } from '../../../stores/itemMetadata';

export const Step04_2_EnrichX: Step = async ({ itemId, url }) => {
  const item = itemsStore.items.get().find(i => i.id === itemId);
  if (item?.content_type !== 'x') return;
  console.log('🧵 [Step04_2_EnrichX] Enriching from X API');
  const id = extractTweetId(url);
  if (!id) return;
  const tweet = await fetchTweetData(id);

  // Media
  const videoMedia = tweet.media?.find(m => m.type === 'video' || m.type === 'animated_gif');
  const videoUrl = videoMedia?.url || undefined;
  const imageUrls = (tweet.media || []).filter(m => m.type === 'photo').map(m => m.url);
  const firstImage = imageUrls[0];

  // Title/desc policy: title is a short snippet (no username), desc is full text
  await itemsActions.updateItemWithSync(itemId, {
    title: '',
    desc: null as any, // keep desc empty for X posts
    thumbnail_url: videoMedia?.previewUrl || firstImage || item.thumbnail_url,
  });

  // Persist media for renderers (cards/views)
  await itemTypeMetadataActions.upsertTypeMetadata({
    item_id: itemId,
    content_type: 'x',
    data: {
      video_url: videoUrl,
      image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    },
  });

  // Persist author/username/published date
  await itemMetadataActions.upsertMetadata({
    item_id: itemId,
    author: tweet.author.name,
    username: tweet.author.username,
    profile_image: tweet.author.profileImage,
    published_date: tweet.createdAt,
  });

  // Optionally mirror posted time on the item if column exists in your DB
  try {
    await itemsActions.updateItemWithSync(itemId, {
      // posted_at is optional; will be ignored by Supabase if column missing in db.updateItem mapping
      // @ts-ignore - field may not exist in local Item type yet
      posted_at: tweet.createdAt as any,
      // store original tweet text in items.post_content instead of desc
      // @ts-ignore - field may not exist in local Item type yet
      post_content: tweet.text as any,
    });
  } catch (e) {
    console.log('ℹ️ [Step04_2_EnrichX] posted_at not updated (column may be missing locally)');
  }

  // Auto-generate video transcript if enabled (non-blocking)
  if (videoUrl) {
    setTimeout(() => {
      itemsActions.autoGenerateXVideoTranscript(itemId).catch(err => {
        console.error('Error auto-generating X video transcript:', err);
      });
    }, 100);
  }

  // Auto-generate image descriptions if enabled (non-blocking)
  if (imageUrls.length > 0) {
    setTimeout(() => {
      itemsActions.autoGenerateXImageDescriptions(itemId).catch(err => {
        console.error('Error auto-generating X image descriptions:', err);
      });
    }, 100);
  }
};


