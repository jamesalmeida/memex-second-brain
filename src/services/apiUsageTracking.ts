import { db } from './supabase';
import { apiUsageTrackingStore, apiUsageTrackingActions } from '../stores/apiUsageTracking';

export interface ApiUsageRecord {
  id: string;
  user_id: string;
  api_name: string;
  operation_type: string;
  item_id?: string | null;
  created_at: string;
}

/**
 * Track API usage that counts against monthly limits
 * This should be called after a successful API operation (not on errors)
 */
export const trackApiUsage = async (
  apiName: 'serpapi',
  operationType: string,
  itemId?: string
): Promise<void> => {
  try {
    // Add to local store immediately for UI responsiveness
    apiUsageTrackingActions.addUsage({
      api_name: apiName,
      operation_type: operationType,
      item_id: itemId,
      created_at: new Date().toISOString(),
    });

    // Save to database (will sync via offline queue if needed)
    const { error } = await db.saveApiUsage({
      api_name: apiName,
      operation_type: operationType,
      item_id: itemId,
    });

    if (error) {
      console.error('[API Usage] Error saving usage to DB:', error);
      // Don't throw - local store already has the record
    } else {
      console.log(`[API Usage] Tracked ${operationType} for ${apiName}`);
    }
  } catch (error) {
    console.error('[API Usage] Error tracking usage:', error);
    // Don't throw - we don't want API tracking to break the main flow
  }
};

/**
 * Get current month's usage count for an API
 */
export const getCurrentMonthUsage = async (apiName: 'serpapi'): Promise<number> => {
  try {
    // Try to get from local store first (fast)
    const localCount = apiUsageTrackingStore.getCurrentMonthUsage(apiName);
    if (localCount !== null) {
      return localCount;
    }

    // Fall back to database query
    const { count, error } = await db.getCurrentMonthApiUsage(apiName);
    if (error) {
      console.error('[API Usage] Error getting usage from DB:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[API Usage] Error getting current month usage:', error);
    return 0;
  }
};

/**
 * Refresh usage count from database (call when needed for accurate count)
 */
export const refreshUsageCount = async (apiName: 'serpapi'): Promise<number> => {
  try {
    const { count, error } = await db.getCurrentMonthApiUsage(apiName);
    if (error) {
      console.error('[API Usage] Error refreshing usage from DB:', error);
      return 0;
    }

    // Update local store
    apiUsageTrackingActions.setCurrentMonthUsage(apiName, count || 0);

    return count || 0;
  } catch (error) {
    console.error('[API Usage] Error refreshing usage count:', error);
    return 0;
  }
};

