-- Migration: Add soft delete support to spaces table
-- This enables tombstone-based sync to prevent deleted spaces from being re-uploaded by other devices

-- Add is_deleted and deleted_at columns to spaces table
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for efficient filtering of deleted spaces
CREATE INDEX IF NOT EXISTS idx_spaces_is_deleted ON spaces(is_deleted);

-- Add comment for documentation
COMMENT ON COLUMN spaces.is_deleted IS 'Soft delete flag - true if space has been deleted but kept as tombstone for sync';
COMMENT ON COLUMN spaces.deleted_at IS 'Timestamp when space was soft-deleted';
