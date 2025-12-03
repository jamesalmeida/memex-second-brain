-- Create assistant_memories table for storing AI assistant memories
CREATE TABLE IF NOT EXISTS assistant_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('preference', 'person', 'fact', 'task', 'project', 'general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_assistant_memories_user_id ON assistant_memories(user_id);

-- Create index on kind for filtering by memory type
CREATE INDEX IF NOT EXISTS idx_assistant_memories_kind ON assistant_memories(kind);

-- Create GIN index on tags for array searches
CREATE INDEX IF NOT EXISTS idx_assistant_memories_tags ON assistant_memories USING GIN(tags);

-- Create full-text search index on title and body
CREATE INDEX IF NOT EXISTS idx_assistant_memories_search ON assistant_memories
  USING GIN(to_tsvector('english', title || ' ' || body));

-- Enable Row Level Security
ALTER TABLE assistant_memories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own memories
CREATE POLICY "Users can view their own memories"
  ON assistant_memories
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own memories
CREATE POLICY "Users can create their own memories"
  ON assistant_memories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own memories
CREATE POLICY "Users can update their own memories"
  ON assistant_memories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own memories
CREATE POLICY "Users can delete their own memories"
  ON assistant_memories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_assistant_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_assistant_memories_updated_at
  BEFORE UPDATE ON assistant_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_assistant_memories_updated_at();

-- Add comment to table
COMMENT ON TABLE assistant_memories IS 'Stores AI assistant memories about users (preferences, facts, people, etc.)';
