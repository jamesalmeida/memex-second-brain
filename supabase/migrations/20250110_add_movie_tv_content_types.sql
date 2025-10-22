-- Add movie and tv_show content types to the content_type check constraint
-- Migration date: 2025-01-10

-- First, drop the existing constraint
ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_content_type_check;

-- Add the new constraint with movie and tv_show content types
ALTER TABLE items 
ADD CONSTRAINT items_content_type_check 
CHECK (content_type IN (
  'bookmark',
  'youtube',
  'youtube_short',
  'x',
  'github',
  'instagram',
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
  'movie',      -- NEW: Movies from IMDB
  'tv_show'     -- NEW: TV Shows from IMDB
));

-- Update any existing IMDB URLs that might have been saved as 'bookmark'
-- Movies have /title/tt followed by numbers
UPDATE items 
SET content_type = 'movie',
    updated_at = now()
WHERE content_type = 'bookmark' 
  AND url LIKE '%imdb.com/title/tt%'
  AND url NOT LIKE '%/episodes%'
  AND url NOT LIKE '%/season%';

-- TV Shows are IMDB titles with episodes or season indicators
UPDATE items
SET content_type = 'tv_show',
    updated_at = now()
WHERE content_type = 'bookmark'
  AND url LIKE '%imdb.com/title/tt%'
  AND (url LIKE '%/episodes%' OR url LIKE '%/season%');

-- Log the migration results
DO $$
DECLARE
  movie_count INTEGER;
  tv_show_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO movie_count FROM items WHERE content_type = 'movie';
  SELECT COUNT(*) INTO tv_show_count FROM items WHERE content_type = 'tv_show';
  
  RAISE NOTICE 'Migration complete. Updated counts: Movies: %, TV Shows: %', 
    movie_count, tv_show_count;
END $$;