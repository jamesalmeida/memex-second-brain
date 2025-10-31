-- Enable real-time replication for admin_settings table
-- This allows all connected clients to receive instant updates when admin settings change

-- Add admin_settings to the real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE admin_settings;

-- Verify the change
DO $$
BEGIN
  RAISE NOTICE '✅ Real-time replication enabled for admin_settings table';
  RAISE NOTICE '   All connected clients will receive instant updates when admin settings change';
  RAISE NOTICE '   No user filtering needed - admin_settings is a global single-row table';
END $$;
