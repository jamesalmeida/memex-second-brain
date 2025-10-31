import { userSettingsStore } from '../stores/userSettings';

/**
 * Check if the current user is an admin
 *
 * Admin status is stored in user_settings.is_admin column.
 * This is loaded automatically when the user signs in.
 *
 * To set a user as admin, run this SQL in Supabase Dashboard → SQL Editor:
 *
 * UPDATE public.user_settings
 * SET is_admin = true
 * WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
 */
export const isAdmin = (): boolean => {
  const settings = userSettingsStore.settings.get();
  if (!settings) return false;

  return settings.is_admin === true;
};

/**
 * Computed observable for reactive admin check
 * Use this in React components with observer() for automatic re-rendering
 */
export const isAdminComputed = () => {
  const settings = userSettingsStore.settings.get();
  if (!settings) return false;
  return settings.is_admin === true;
};
