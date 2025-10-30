import { observable } from '@legendapp/state';
import type { ApiUsageRecord } from '../services/apiUsageTracking';

export interface ApiUsageTrackingState {
  records: ApiUsageRecord[];
  currentMonthUsage: {
    serpapi: number | null; // null means not loaded yet
  };
}

const initialState: ApiUsageTrackingState = {
  records: [],
  currentMonthUsage: {
    serpapi: null,
  },
};

export const apiUsageTrackingStore = observable(initialState);

export const apiUsageTrackingActions = {
  addUsage: (usage: Omit<ApiUsageRecord, 'id' | 'user_id'>) => {
    const record: ApiUsageRecord = {
      id: `local-${Date.now()}-${Math.random()}`,
      user_id: '', // Will be set by DB
      ...usage,
    };
    
    apiUsageTrackingStore.records.set([...apiUsageTrackingStore.records.get(), record]);
    
    // Update current month count if this is a current month record
    const now = new Date();
    const usageDate = new Date(usage.created_at);
    if (usageDate.getFullYear() === now.getFullYear() && 
        usageDate.getMonth() === now.getMonth()) {
      const current = apiUsageTrackingStore.currentMonthUsage.serpapi.get();
      if (current !== null) {
        apiUsageTrackingStore.currentMonthUsage.serpapi.set(current + 1);
      }
    }
  },

  setCurrentMonthUsage: (apiName: 'serpapi', count: number) => {
    apiUsageTrackingStore.currentMonthUsage[apiName].set(count);
  },

  getCurrentMonthUsage: (apiName: 'serpapi'): number | null => {
    return apiUsageTrackingStore.currentMonthUsage[apiName].get();
  },

  clear: () => {
    apiUsageTrackingStore.set(initialState);
  },
};

