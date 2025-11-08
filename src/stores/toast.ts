import { observable } from '@legendapp/state';

export const toastStore = observable({
  message: null as string | null,
  visible: false,
  type: 'info' as 'success' | 'error' | 'info',
});

export const toastActions = {
  show: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    toastStore.message.set(message);
    toastStore.type.set(type);
    toastStore.visible.set(true);

    setTimeout(() => {
      toastStore.visible.set(false);
    }, 3000);
  },

  hide: () => {
    toastStore.visible.set(false);
  },
};
