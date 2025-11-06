/**
 * Keychain configuration for sharing auth between app and share extension
 *
 * iOS Keychain Access Groups allow multiple app targets (main app + extensions)
 * to access the same keychain items securely.
 *
 * Format: <TeamID>.<suffix>
 * - In entitlements: $(AppIdentifierPrefix)com.jamesalmeida.memex
 * - At runtime: WZRRA4NFBY.com.jamesalmeida.memex
 *
 * Note: Team ID is hardcoded because it cannot be dynamically resolved in JavaScript.
 * If the Team ID changes, update this constant.
 */

export const KEYCHAIN_CONFIG = {
  /**
   * Access group for shared keychain items
   * Must match the resolved value of $(AppIdentifierPrefix)com.jamesalmeida.memex
   * from the entitlements files
   */
  ACCESS_GROUP: 'WZRRA4NFBY.com.jamesalmeida.memex',

  /**
   * Key for storing minimal Supabase session
   * This key is used to store/retrieve auth credentials that are shared
   * between the main app and share extension
   */
  SESSION_KEY: 'supabase.session.min',
} as const;
