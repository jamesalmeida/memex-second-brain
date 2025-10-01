-- Enhance Chat Schema for AI Chat Feature
-- Adds metadata tracking, titles, updated_at, and performance indexes

-- Add metadata column to chat_messages for tracking model info, tokens, etc.
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add title field to item_chats for better UX (can name conversations)
ALTER TABLE public.item_chats
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- Add title and updated_at to space_chats for consistency
ALTER TABLE public.space_chats
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- Create index for better chat message loading performance (pagination support)
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id_created_at
ON public.chat_messages(chat_id, created_at DESC);

-- Create index on chat_type for filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_type
ON public.chat_messages(chat_type);

-- Create index on metadata for JSONB queries (e.g., filtering by model)
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata
ON public.chat_messages USING GIN (metadata);

-- Create trigger function to auto-update updated_at when messages are added
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.chat_type = 'item' THEN
    UPDATE public.item_chats
    SET updated_at = NEW.created_at
    WHERE id = NEW.chat_id;
  ELSIF NEW.chat_type = 'space' THEN
    UPDATE public.space_chats
    SET updated_at = NEW.created_at
    WHERE id = NEW.chat_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update chat timestamp when messages are added
DROP TRIGGER IF EXISTS chat_message_updates_chat_timestamp ON public.chat_messages;
CREATE TRIGGER chat_message_updates_chat_timestamp
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN public.chat_messages.metadata IS 'Stores AI model metadata including model name, token usage, and timestamp';
COMMENT ON COLUMN public.item_chats.title IS 'Optional custom title for the chat conversation';
COMMENT ON COLUMN public.item_chats.updated_at IS 'Timestamp of last message in chat (auto-updated via trigger)';
COMMENT ON COLUMN public.space_chats.title IS 'Optional custom title for the chat conversation';
COMMENT ON COLUMN public.space_chats.updated_at IS 'Timestamp of last message in chat (auto-updated via trigger)';
