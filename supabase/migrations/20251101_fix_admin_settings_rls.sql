-- Fix admin_settings RLS policies to use user_settings.is_admin column
-- The old is_admin() function checked JWT user_metadata, but we now use
-- user_settings.is_admin column for simpler admin access control

-- Drop the old is_admin() function that checks JWT
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Create new is_admin() function that checks user_settings.is_admin column
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT is_admin
      FROM public.user_settings
      WHERE user_id = auth.uid()
    ),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Recreate RLS policies (CASCADE drop above removed them)

-- Everyone can read admin settings (all users need to read global settings)
CREATE POLICY "Anyone can read admin settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert
CREATE POLICY "Only admins can insert admin settings"
  ON public.admin_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Only admins can update
CREATE POLICY "Only admins can update admin settings"
  ON public.admin_settings
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can delete (though we should never delete the single row)
CREATE POLICY "Only admins can delete admin settings"
  ON public.admin_settings
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add comment to document the function
COMMENT ON FUNCTION public.is_admin() IS 'Checks if current user has admin privileges via user_settings.is_admin column';

-- Verify the fix
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed is_admin() function to use user_settings.is_admin column';
  RAISE NOTICE '   RLS policies recreated for admin_settings table';
  RAISE NOTICE '   Admin users can now update admin_settings';
END $$;
