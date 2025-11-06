-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a table to store configuration (Supabase URL and Service Role Key)
CREATE TABLE IF NOT EXISTS _pg_net_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Enable RLS but allow service role full access
ALTER TABLE _pg_net_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to config"
  ON _pg_net_config
  USING (auth.jwt()->>'role' = 'service_role');

-- Note: After running this migration, you need to insert your config:
-- INSERT INTO _pg_net_config (key, value) VALUES
--   ('supabase_url', 'https://your-project-ref.supabase.co'),
--   ('service_role_key', 'your-service-role-key-here')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Trigger function that reads config from the table
CREATE OR REPLACE FUNCTION process_pending_item_trigger()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Read config from table
  SELECT value INTO supabase_url FROM _pg_net_config WHERE key = 'supabase_url';
  SELECT value INTO service_role_key FROM _pg_net_config WHERE key = 'service_role_key';

  -- Only proceed if config is set
  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    -- Invoke Edge Function via pg_net
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-pending-item',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'pending_item_id', NEW.id,
        'user_id', NEW.user_id,
        'url', NEW.url,
        'space_id', NEW.space_id,
        'content', NEW.content
      )
    );
  ELSE
    RAISE WARNING 'pg_net config not set - pending item will not be processed automatically';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_process_pending_item
  AFTER INSERT ON pending_items
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_item_trigger();
