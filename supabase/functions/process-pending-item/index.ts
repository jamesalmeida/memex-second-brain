// Supabase Edge Function to process pending items and extract metadata
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Simple metadata extraction (can be enhanced with full extractURLMetadata logic)
const extractMetadata = async (url: string) => {
  try {
    // Detect content type from URL
    const urlLower = url.toLowerCase()
    let contentType = 'bookmark'

    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      contentType = 'youtube'
    } else if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      contentType = 'x'
    } else if (urlLower.includes('instagram.com')) {
      contentType = 'instagram'
    } else if (urlLower.includes('reddit.com')) {
      contentType = 'reddit'
    } else if (urlLower.includes('tiktok.com')) {
      contentType = 'tiktok'
    } else if (urlLower.includes('amazon.com')) {
      contentType = 'amazon'
    } else if (urlLower.includes('imdb.com')) {
      contentType = 'movie'
    }

    // Fetch page for OG tags
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MemexBot/1.0)',
      },
    })
    const html = await response.text()

    // Extract OG tags (simplified)
    const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/) ||
                      html.match(/<title>([^<]*)<\/title>/)
    const descMatch = html.match(/<meta property="og:description" content="([^"]*)"/) ||
                     html.match(/<meta name="description" content="([^"]*)"/)
    const imageMatch = html.match(/<meta property="og:image" content="([^"]*)"/)

    return {
      title: titleMatch?.[1] || url,
      description: descMatch?.[1],
      thumbnail_url: imageMatch?.[1],
      content_type: contentType,
    }
  } catch (error) {
    console.error('Metadata extraction error:', error)
    return {
      title: url,
      description: null,
      thumbnail_url: null,
      content_type: 'bookmark',
    }
  }
}

serve(async (req) => {
  let pending_item_id: string | undefined;

  try {
    const body = await req.json();
    pending_item_id = body.pending_item_id;
    const { user_id, url, space_id, content } = body;

    console.log('[ProcessPendingItem] Processing:', pending_item_id, url)

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('[ProcessPendingItem] Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('[ProcessPendingItem] Service role key:', supabaseKey ? 'Set' : 'Missing');

    const supabase = createClient(
      supabaseUrl ?? '',
      supabaseKey ?? ''
    )

    // Update status to processing
    const { error: updateError } = await supabase
      .from('pending_items')
      .update({ status: 'processing' })
      .eq('id', pending_item_id)

    if (updateError) {
      console.error('[ProcessPendingItem] Error updating status to processing:', updateError);
    } else {
      console.log('[ProcessPendingItem] Status updated to processing');
    }

    // Extract metadata
    const metadata = await extractMetadata(url)

    console.log('[ProcessPendingItem] Metadata extracted:', metadata.title, metadata.content_type)

    // Prepare item data
    const itemData = {
      user_id,
      title: metadata.title,
      url,
      content_type: metadata.content_type,
      desc: metadata.description,
      thumbnail_url: metadata.thumbnail_url,
      content,
      space_id,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_archived: false,
      is_deleted: false,
    };

    console.log('[ProcessPendingItem] Attempting to insert item with data:', {
      user_id,
      content_type: metadata.content_type,
      space_id,
      has_title: !!metadata.title,
      has_url: !!url,
    });

    // Insert into items table
    const { data: item, error: insertError } = await supabase
      .from('items')
      .insert(itemData)
      .select()
      .single()

    if (insertError) {
      console.error('[ProcessPendingItem] Insert error:', insertError)
      console.error('[ProcessPendingItem] Insert error details:', JSON.stringify(insertError, null, 2))
      throw insertError
    }

    if (!item) {
      console.error('[ProcessPendingItem] No item returned after insert!')
      throw new Error('Item insert succeeded but returned no data')
    }

    console.log('[ProcessPendingItem] Item created successfully:', item.id)

    // Mark pending item as completed
    await supabase
      .from('pending_items')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', pending_item_id)

    return new Response(
      JSON.stringify({
        success: true,
        item_id: item.id,
        title: item.title
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('[ProcessPendingItem] Error:', error)

    // Try to mark as failed if we have the pending_item_id
    if (pending_item_id) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await supabase
          .from('pending_items')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error'
          })
          .eq('id', pending_item_id)
      } catch (updateError) {
        console.error('Failed to update error status:', updateError)
      }
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
