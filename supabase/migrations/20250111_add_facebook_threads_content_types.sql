-- Add facebook and threads content types to the content_type check constraint
-- Migration date: 2025-01-11

-- First, drop the existing constraint
ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_content_type_check;

-- Add the new constraint with facebook and threads content types
ALTER TABLE items 
ADD CONSTRAINT items_content_type_check 
CHECK (content_type IN (
  'bookmark',
  'youtube',
  'youtube_short',
  'x',
  'github',
  'instagram',
  'facebook',    -- NEW: Facebook posts/pages
  'threads',     -- NEW: Threads posts
  'tiktok',
  'reddit',
  'amazon',
  'linkedin',
  'image',
  'pdf',
  'video',
  'audio',
  'podcast',
  'note',
  'article',
  'product',
  'book',
  'course',
  'movie',
  'tv_show'
));

-- Update any existing Facebook URLs that might have been saved as 'bookmark'
UPDATE items 
SET content_type = 'facebook',
    updated_at = now()
WHERE content_type = 'bookmark' 
  AND (url LIKE '%facebook.com%' 
       OR url LIKE '%fb.com%' 
       OR url LIKE '%fb.watch%');

-- Update any existing Threads URLs that might have been saved as 'bookmark'
UPDATE items
SET content_type = 'threads',
    updated_at = now()
WHERE content_type = 'bookmark'
  AND url LIKE '%threads.com%';

-- Log the migration results
DO $$
DECLARE
  facebook_count INTEGER;
  threads_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO facebook_count FROM items WHERE content_type = 'facebook';
  SELECT COUNT(*) INTO threads_count FROM items WHERE content_type = 'threads';
  
  RAISE NOTICE 'Migration complete. Updated counts: Facebook: %, Threads: %', 
    facebook_count, threads_count;
END $$;