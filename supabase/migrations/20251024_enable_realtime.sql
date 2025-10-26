-- Enable real-time for items table
ALTER PUBLICATION supabase_realtime ADD TABLE items;

-- Enable real-time for spaces table
ALTER PUBLICATION supabase_realtime ADD TABLE spaces;
