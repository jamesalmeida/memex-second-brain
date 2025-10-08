import React, { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react';

interface DrawerContextType {
  openDrawer: () => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  drawerRef: React.MutableRefObject<any>;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export const useDrawer = () => {
  const context = useContext(DrawerContext);
  if (!context) {
    console.warn('⚠️ useDrawer must be used within DrawerProvider');
    return {
      openDrawer: () => console.log('⚠️ Drawer context not available'),
      closeDrawer: () => console.log('⚠️ Drawer context not available'),
      isDrawerOpen: false,
      drawerRef: { current: null },
    };
  }
  return context;
};

interface DrawerProviderProps {
  children: ReactNode;
}

export const DrawerProvider = ({ children }: DrawerProviderProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<any>(null);

  const openDrawer = useCallback(() => {
    console.log('🍔 [DrawerContext] openDrawer called');
    console.log('🍔 [DrawerContext] drawerRef.current:', drawerRef.current);

    if (drawerRef.current) {
      console.log('🍔 [DrawerContext] Calling openDrawer() on ref');
      drawerRef.current.openDrawer();
    } else {
      console.log('🍔 [DrawerContext] drawerRef is null, setting state instead');
      setIsDrawerOpen(true);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    console.log('🚪 [DrawerContext] closeDrawer called');

    if (drawerRef.current) {
      drawerRef.current.closeDrawer();
    } else {
      setIsDrawerOpen(false);
    }
  }, []);

  const value = {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    drawerRef,
  };

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
};
