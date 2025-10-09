import { supabase, db } from './supabase';
import { Item, Space, ItemSpace, ItemMetadata, ItemTypeMetadata, VideoTranscript, ImageDescription } from '../types';
import { authStore } from '../stores/auth';

export const syncOperations = {
  async uploadItem(item: Item, userId: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(item.id)) {
      console.log(`⚠️ Skipping item with invalid UUID: ${item.id}`);
      return;
    }

    const validContentTypes = ['bookmark', 'youtube', 'youtube_short', 'x', 'github', 'instagram', 'tiktok', 'reddit', 'amazon', 'linkedin', 'image', 'pdf', 'video', 'audio', 'note', 'article', 'product', 'book', 'course'];
    const contentType = validContentTypes.includes(item.content_type) ? item.content_type : 'bookmark';

    const { error } = await db.createItem({
      id: item.id,
      user_id: userId,
      title: item.title,
      desc: item.desc || null,
      content: item.content || null,
      url: item.url || null,
      thumbnail_url: item.thumbnail_url || null,
      content_type: contentType,
      is_archived: item.is_archived || false,
      raw_text: item.raw_text || null,
    });

    if (error) throw error;
  },

  async updateItem(itemId: string, updates: Partial<Item>) {
    const { error } = await db.updateItem(itemId, updates);
    if (error) throw error;
    console.log(`✅ Updated item ${itemId} in Supabase`);
  },

  async upsertItemTypeMetadata(metadata: ItemTypeMetadata) {
    const { error } = await supabase
      .from('item_type_metadata')
      .upsert({
        item_id: metadata.item_id,
        content_type: metadata.content_type,
        data: metadata.data,
      }, {
        onConflict: 'item_id',
      });

    if (error) throw error;
    console.log(`✅ Upserted item_type_metadata for item ${metadata.item_id}`);
  },

  async deleteItemTypeMetadata(itemId: string) {
    const { error } = await supabase
      .from('item_type_metadata')
      .delete()
      .eq('item_id', itemId);

    if (error) throw error;
    console.log(`✅ Deleted item_type_metadata for item ${itemId}`);
  },

  async deleteItem(itemId: string) {
    console.log(`🗑️ [syncOperations] Attempting to delete item ${itemId} from Supabase`);
    const { error } = await db.deleteItem(itemId);
    if (error) {
      console.error(`🗑️ [syncOperations] Error deleting item ${itemId}:`, error);
      throw error;
    }
    console.log(`✅ [syncOperations] Successfully deleted item ${itemId} from Supabase`);
  },

  async uploadSpace(space: Space, userId: string) {
    const { error } = await supabase
      .from('spaces')
      .insert({
        id: space.id,
        user_id: userId,
        name: space.name,
        description: space.description || space.desc || null,
        color: space.color,
        item_count: space.item_count || 0,
        created_at: space.created_at || new Date().toISOString(),
        updated_at: space.updated_at || new Date().toISOString(),
      });
    
    if (error) throw error;
    console.log(`✅ Created space ${space.name} in Supabase`);
  },

  async updateSpace(space: Space) {
    const { error } = await supabase
      .from('spaces')
      .update({
        name: space.name,
        description: space.description || space.desc || null,
        color: space.color,
        item_count: space.item_count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', space.id);
    
    if (error) throw error;
    console.log('✅ Space updated in Supabase:', space.name);
  },

  async deleteSpace(spaceId: string) {
    const { error: itemSpacesError } = await supabase
      .from('item_spaces')
      .delete()
      .eq('space_id', spaceId);
    
    if (itemSpacesError) {
      console.error('Error deleting item_spaces relationships:', itemSpacesError);
    }
    
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId);
    
    if (error) throw error;
    console.log('✅ Space deleted from Supabase:', spaceId);
  },

  async addItemToSpace(itemId: string, spaceId: string) {
    const { error } = await supabase
      .from('item_spaces')
      .insert({
        item_id: itemId,
        space_id: spaceId,
      });
    
    if (error) throw error;
    console.log(`✅ Added item ${itemId} to space ${spaceId} in Supabase`);
    
    await this.updateSpaceItemCount(spaceId);
  },

  async removeItemFromSpace(itemId: string, spaceId: string) {
    const { error } = await supabase
      .from('item_spaces')
      .delete()
      .eq('item_id', itemId)
      .eq('space_id', spaceId);
    
    if (error) throw error;
    console.log(`✅ Removed item ${itemId} from space ${spaceId} in Supabase`);
    
    await this.updateSpaceItemCount(spaceId);
  },

  async updateSpaceItemCount(spaceId: string) {
    const { count, error: countError } = await supabase
      .from('item_spaces')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', spaceId);
    
    if (countError) throw countError;
    
    const { error: updateError } = await supabase
      .from('spaces')
      .update({ 
        item_count: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', spaceId);
    
    if (updateError) throw updateError;
    
    console.log(`✅ Updated space ${spaceId} item count to ${count}`);
  },

  async uploadVideoTranscript(transcript: VideoTranscript) {
    const { error } = await db.saveVideoTranscript({
      item_id: transcript.item_id,
      transcript: transcript.transcript,
      platform: transcript.platform,
      language: transcript.language,
      duration: transcript.duration,
    });
    
    if (error) throw error;
    console.log(`✅ Uploaded video transcript for item ${transcript.item_id}`);
  },

  async deleteVideoTranscript(itemId: string) {
    const { error } = await db.deleteVideoTranscript(itemId);
    if (error) throw error;
    console.log(`✅ Deleted video transcript for item ${itemId}`);
  },

  async uploadImageDescription(description: ImageDescription) {
    const { error } = await db.saveImageDescription({
      item_id: description.item_id,
      image_url: description.image_url,
      description: description.description,
      model: description.model,
    });

    if (error) throw error;
    console.log(`✅ Uploaded image description for item ${description.item_id} (${description.image_url})`);
  },

  async deleteImageDescription(itemId: string, imageUrl?: string) {
    const { error } = await db.deleteImageDescription(itemId, imageUrl);
    if (error) throw error;
    console.log(`✅ Deleted image description(s) for item ${itemId}${imageUrl ? ` (${imageUrl})` : ''}`);
  },

  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.auth.getSession();
      return !error;
    } catch {
      return false;
    }
  }
};