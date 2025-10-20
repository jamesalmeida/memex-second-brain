import { observable } from '@legendapp/state';

interface ProcessingState {
  ids: Record<string, boolean>;
}

const initialState: ProcessingState = {
  ids: {},
};

export const processingItemsStore = observable(initialState);

export const processingItemsComputed = {
  isProcessing: (id: string) => !!processingItemsStore.ids.get()?.[id],
  all: () => processingItemsStore.ids.get(),
};

export const processingItemsActions = {
  add: (id: string) => {
    const current = processingItemsStore.ids.get();
    processingItemsStore.ids.set({ ...current, [id]: true });
  },
  remove: (id: string) => {
    const current = processingItemsStore.ids.get();
    if (!current || !current[id]) return;
    const { [id]: _omit, ...rest } = current;
    processingItemsStore.ids.set(rest);
  },
  clearAll: () => {
    processingItemsStore.ids.set({});
  },
};


