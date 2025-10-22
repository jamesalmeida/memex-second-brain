-- Add missing content types (youtube_short, instagram, reddit, etc.) to the content_type check constraint
-- Migration date: 2025-01-10

-- First, drop the existing constraint
ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_content_type_check;

-- Add the new constraint with ALL content types from our TypeScript ContentType type
-- This ensures database is in sync with application code
ALTER TABLE items 
ADD CONSTRAINT items_content_type_check 
CHECK (content_type IN (
  'bookmark',
  'youtube',
  'youtube_short',  -- NEW: YouTube Shorts
  'x',              -- Twitter/X
  'github',
  'instagram',      -- NEW: Instagram posts
  'tiktok',
  'reddit',         -- NEW: Reddit posts
  'amazon',
  'linkedin',
  'image',
  'pdf',
  'video',
  'audio',
  'podcast',        -- NEW: Podcast episodes
  'note',
  'article',
  'product',
  'book',
  'course'
));

-- Update any existing YouTube shorts that might have been saved as 'youtube'
-- This will convert any YouTube URLs containing '/shorts/' to the youtube_short type
UPDATE items 
SET content_type = 'youtube_short',
    updated_at = now()
WHERE content_type = 'youtube' 
  AND url LIKE '%youtube.com/shorts/%';

-- Update any Instagram URLs that might have been saved as 'bookmark' or 'image'
UPDATE items
SET content_type = 'instagram',
    updated_at = now()
WHERE content_type IN ('bookmark', 'image')
  AND url LIKE '%instagram.com/%';

-- Update any Reddit URLs that might have been saved as 'bookmark' or 'article'
UPDATE items
SET content_type = 'reddit',
    updated_at = now()
WHERE content_type IN ('bookmark', 'article')
  AND url LIKE '%reddit.com/%';

-- Log the migration results
DO $$
DECLARE
  youtube_short_count INTEGER;
  instagram_count INTEGER;
  reddit_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO youtube_short_count FROM items WHERE content_type = 'youtube_short';
  SELECT COUNT(*) INTO instagram_count FROM items WHERE content_type = 'instagram';
  SELECT COUNT(*) INTO reddit_count FROM items WHERE content_type = 'reddit';
  
  RAISE NOTICE 'Migration complete. Updated counts: YouTube Shorts: %, Instagram: %, Reddit: %', 
    youtube_short_count, instagram_count, reddit_count;
END $$;