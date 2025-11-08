-- Create pending_items table for share extension quick saves
CREATE TABLE IF NOT EXISTS pending_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pending_items_status ON pending_items(status);
CREATE INDEX IF NOT EXISTS idx_pending_items_user ON pending_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_items_created_at ON pending_items(created_at DESC);

-- Enable Row Level Security
ALTER TABLE pending_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own pending items"
  ON pending_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own pending items"
  ON pending_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending items"
  ON pending_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pending items"
  ON pending_items FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for Edge Function)
CREATE POLICY "Service role has full access to pending items"
  ON pending_items
  USING (auth.jwt()->>'role' = 'service_role');

-- Enable realtime for pending_items
ALTER PUBLICATION supabase_realtime ADD TABLE pending_items;
