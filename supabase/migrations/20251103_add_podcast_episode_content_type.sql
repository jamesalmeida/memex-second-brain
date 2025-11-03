-- Add 'podcast_episode' and other missing content types to the content_type CHECK constraint
-- This allows differentiation between podcast homepages and specific episodes
-- Also adds other content types that were missing from the original schema

-- First, drop the existing CHECK constraint
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_content_type_check;

-- Add new CHECK constraint with all content types (including podcast_episode)
ALTER TABLE public.items ADD CONSTRAINT items_content_type_check CHECK (
    content_type IN (
        'bookmark',
        'youtube',
        'youtube_short',
        'x',
        'github',
        'instagram',
        'facebook',
        'threads',
        'tiktok',
        'reddit',
        'amazon',
        'ebay',
        'yelp',
        'app_store',
        'linkedin',
        'image',
        'pdf',
        'video',
        'audio',
        'podcast',
        'podcast_episode',
        'note',
        'article',
        'product',
        'book',
        'course',
        'movie',
        'tv_show'
    )
);
