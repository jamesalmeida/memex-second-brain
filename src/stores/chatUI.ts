import { observable } from '@legendapp/state';
import { Item } from '../types';

/**
 * UI state store for managing chat sheet visibility and current item
 * This follows the pattern used by other UI stores in the app
 */
export const chatUIStore = observable({
  isOpen: false,
  currentItem: null as Item | null,
});

export const chatUIActions = {
  /**
   * Open chat for a specific item
   */
  openChat: (item: Item) => {
    console.log('🚀 [chatUIActions] openChat called for item:', item.id, item.title);
    console.log('🚀 [chatUIActions] Setting currentItem...');
    chatUIStore.currentItem.set(item);
    console.log('🚀 [chatUIActions] Setting isOpen to true...');
    chatUIStore.isOpen.set(true);
    console.log('🚀 [chatUIActions] isOpen is now:', chatUIStore.isOpen.get());
  },

  /**
   * Close the chat sheet
   */
  closeChat: () => {
    console.log('🚀 [chatUIActions] closeChat called');
    chatUIStore.isOpen.set(false);
    // Keep currentItem for a moment to allow smooth close animation
    setTimeout(() => {
      chatUIStore.currentItem.set(null);
    }, 300);
  },
};
