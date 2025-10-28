-- Migration: Add TLDR and Notes fields to items table
-- This migration adds:
-- 1. tldr column for AI-generated summaries of item content
-- 2. notes column for user's personal annotations

-- Step 1: Add tldr column
ALTER TABLE items
ADD COLUMN IF NOT EXISTS tldr TEXT;

-- Step 2: Add notes column
ALTER TABLE items
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Step 3: Add indexes for efficient querying (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_items_tldr ON items(tldr) WHERE tldr IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_notes ON items(notes) WHERE notes IS NOT NULL;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN items.tldr IS 'AI-generated summary of item content (description, transcript, images, metadata)';
COMMENT ON COLUMN items.notes IS 'User''s personal notes and annotations about the item';
