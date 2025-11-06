import { consoleLogSettingsStore, ConsoleLogSettings } from '../stores/consoleLogSettings';

/**
 * Console Utility
 *
 * Wrapper around console.log/warn/error that respects the console log settings.
 * Use these functions instead of direct console.* calls to enable granular control.
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/utils/console';
 *
 * // Instead of: console.log('Syncing items...')
 * logger.sync.log('Syncing items...');
 *
 * // Instead of: console.error('Auth failed:', error)
 * logger.auth.error('Auth failed:', error);
 * ```
 */

type LogCategory = keyof ConsoleLogSettings['categories'];

interface CategoryLogger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * Creates a logger for a specific category
 */
function createCategoryLogger(category: LogCategory): CategoryLogger {
  const shouldLog = () => {
    const masterEnabled = consoleLogSettingsStore.enabled.get();
    const categoryEnabled = consoleLogSettingsStore.categories[category].get();
    return masterEnabled && categoryEnabled;
  };

  return {
    log: (...args: any[]) => {
      if (shouldLog()) {
        console.log(...args);
      }
    },
    warn: (...args: any[]) => {
      if (shouldLog()) {
        console.warn(...args);
      }
    },
    error: (...args: any[]) => {
      if (shouldLog()) {
        console.error(...args);
      }
    },
    info: (...args: any[]) => {
      if (shouldLog()) {
        console.info(...args);
      }
    },
    debug: (...args: any[]) => {
      if (shouldLog()) {
        console.debug(...args);
      }
    },
  };
}

/**
 * Logger object with category-specific loggers
 *
 * Each category respects both the master toggle and its specific toggle.
 */
export const logger = {
  /** Sync & Offline Queue operations */
  sync: createCategoryLogger('sync'),

  /** Chat & Messaging */
  chat: createCategoryLogger('chat'),

  /** Authentication & Login */
  auth: createCategoryLogger('auth'),

  /** Transcript Generation */
  transcripts: createCategoryLogger('transcripts'),

  /** Drawer & Bottom Sheets */
  drawer: createCategoryLogger('drawer'),

  /** Item Saving & Creation */
  items: createCategoryLogger('items'),

  /** Enrichment Pipeline */
  enrichment: createCategoryLogger('enrichment'),

  /** External API Integration */
  api: createCategoryLogger('api'),

  /** Data Metadata & Storage */
  metadata: createCategoryLogger('metadata'),

  /** UI/Navigation & Drawer Context */
  navigation: createCategoryLogger('navigation'),

  /** Admin Settings & Configuration */
  admin: createCategoryLogger('admin'),

  /** Image Operations & Uploads */
  images: createCategoryLogger('images'),

  /**
   * General logger (always enabled, ignores category toggles)
   * Use this for critical system logs that should always be shown
   */
  general: {
    log: (...args: any[]) => {
      if (consoleLogSettingsStore.enabled.get()) {
        console.log(...args);
      }
    },
    warn: (...args: any[]) => {
      if (consoleLogSettingsStore.enabled.get()) {
        console.warn(...args);
      }
    },
    error: (...args: any[]) => {
      if (consoleLogSettingsStore.enabled.get()) {
        console.error(...args);
      }
    },
    info: (...args: any[]) => {
      if (consoleLogSettingsStore.enabled.get()) {
        console.info(...args);
      }
    },
    debug: (...args: any[]) => {
      if (consoleLogSettingsStore.enabled.get()) {
        console.debug(...args);
      }
    },
  },
};

/**
 * Helper to create a simple logger that always checks the master toggle
 * Use this for one-off logs that don't fit into a specific category
 */
export function createSimpleLogger() {
  return logger.general;
}

/**
 * Type for logger categories
 */
export type LoggerCategory = keyof typeof logger;
