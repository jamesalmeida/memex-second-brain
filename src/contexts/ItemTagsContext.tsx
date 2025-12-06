import React, { createContext, useContext, useRef, useCallback, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';

interface ItemTagsContextType {
  openTagsSheet: (tags: string[], onDone: (tags: string[]) => void | Promise<void>) => void;
  tagsSheetRef: React.RefObject<BottomSheet & { openWithTags?: (tags: string[]) => void }>;
  onDoneCallbackRef: React.MutableRefObject<((tags: string[]) => void | Promise<void>) | null>;
}

const ItemTagsContext = createContext<ItemTagsContextType | undefined>(undefined);

export const ItemTagsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const tagsSheetRef = useRef<BottomSheet & { openWithTags?: (tags: string[]) => void }>(null);
  const onDoneCallbackRef = useRef<((tags: string[]) => void | Promise<void>) | null>(null);

  const openTagsSheet = useCallback((tags: string[], onDone: (tags: string[]) => void | Promise<void>) => {
    // Store the callback
    onDoneCallbackRef.current = onDone;

    // Open the sheet with the tags
    if (tagsSheetRef.current?.openWithTags) {
      tagsSheetRef.current.openWithTags(tags);
    }
    tagsSheetRef.current?.snapToIndex(0);
  }, []);

  return (
    <ItemTagsContext.Provider value={{ openTagsSheet, tagsSheetRef, onDoneCallbackRef }}>
      {children}
    </ItemTagsContext.Provider>
  );
};

export const useItemTags = () => {
  const context = useContext(ItemTagsContext);
  if (!context) {
    throw new Error('useItemTags must be used within ItemTagsProvider');
  }
  return context;
};
