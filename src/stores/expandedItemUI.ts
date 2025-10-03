import { observable } from '@legendapp/state';
import { Item } from '../types';

/**
 * UI state store for managing expanded item sheet visibility and current item
 * This follows the pattern used by chatUI store
 */
export const expandedItemUIStore = observable({
  currentItem: null as Item | null,
});

export const expandedItemUIActions = {
  /**
   * Expand a specific item
   */
  expandItem: (item: Item) => {
    console.log('🚀 [expandedItemUIActions] expandItem called for item:', item.id, item.title);
    expandedItemUIStore.currentItem.set(item);
  },

  /**
   * Close the expanded item sheet
   */
  closeExpandedItem: () => {
    console.log('🚀 [expandedItemUIActions] closeExpandedItem called');
    expandedItemUIStore.currentItem.set(null);
  },
};
