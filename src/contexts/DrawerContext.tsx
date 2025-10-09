import React, { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react';

interface DrawerContextType {
  openDrawer: () => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  drawerRef: React.MutableRefObject<any>;
  onSettingsPress: () => void;
  registerSettingsHandler: (handler: () => void) => void;
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
      onSettingsPress: () => console.log('⚠️ Drawer context not available'),
      registerSettingsHandler: () => console.log('⚠️ Drawer context not available'),
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
  const settingsHandlerRef = useRef<(() => void) | null>(null);

  // Log when isDrawerOpen changes
  React.useEffect(() => {
    console.log('🎯 [DrawerContext] isDrawerOpen state changed to:', isDrawerOpen);
  }, [isDrawerOpen]);

  const openDrawer = useCallback(() => {
    console.log('🍔 [DrawerContext] openDrawer called');
    console.log('🍔 [DrawerContext] drawerRef.current:', drawerRef.current);
    console.log('🍔 [DrawerContext] Setting isDrawerOpen to true');
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    console.log('🚪 [DrawerContext] closeDrawer called');
    console.log('🚪 [DrawerContext] Setting isDrawerOpen to false');
    setIsDrawerOpen(false);
  }, []);

  const registerSettingsHandler = useCallback((handler: () => void) => {
    console.log('⚙️ [DrawerContext] Registering settings handler');
    settingsHandlerRef.current = handler;
  }, []);

  const onSettingsPress = useCallback(() => {
    console.log('⚙️ [DrawerContext] onSettingsPress called');
    console.log('⚙️ [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before opening settings
    setTimeout(() => {
      if (settingsHandlerRef.current) {
        console.log('⚙️ [DrawerContext] Calling registered settings handler');
        settingsHandlerRef.current();
      } else {
        console.warn('⚠️ [DrawerContext] No settings handler registered');
      }
    }, 300); // Match drawer animation duration
  }, []);

  const value = {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    drawerRef,
    onSettingsPress,
    registerSettingsHandler,
  };

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
};
