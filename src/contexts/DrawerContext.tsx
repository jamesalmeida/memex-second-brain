import React, { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react';
import { DrawerLayout } from 'react-native-drawer-layout';

interface DrawerContextType {
  openDrawer: () => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  drawerRef: React.RefObject<DrawerLayout>;
  onSettingsPress: () => void;
  registerSettingsHandler: (handler: () => void) => void;
  onAdminPress: () => void;
  registerAdminHandler: (handler: () => void) => void;
  onTagManagerPress: () => void;
  registerTagManagerHandler: (handler: () => void) => void;
  onCreateSpacePress: () => void;
  registerCreateSpaceHandler: (handler: () => void) => void;
  onEditSpacePress: (spaceId: string) => void;
  registerEditSpaceHandler: (handler: (spaceId: string) => void) => void;
  onNavigateToSpace: (spaceId: string) => void;
  registerNavigateToSpaceHandler: (handler: (spaceId: string) => void) => void;
  onNavigateToEverything: () => void;
  registerNavigateToEverythingHandler: (handler: () => void) => void;
  onReorderSpacesPress: () => void;
  registerReorderSpacesHandler: (handler: () => void) => void;
  currentView: 'everything' | 'spaces' | null;
  setCurrentView: (view: 'everything' | 'spaces') => void;
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
      onAdminPress: () => console.log('⚠️ Drawer context not available'),
      registerAdminHandler: () => console.log('⚠️ Drawer context not available'),
      onTagManagerPress: () => console.log('⚠️ Drawer context not available'),
      registerTagManagerHandler: () => console.log('⚠️ Drawer context not available'),
      onCreateSpacePress: () => console.log('⚠️ Drawer context not available'),
      registerCreateSpaceHandler: () => console.log('⚠️ Drawer context not available'),
      onEditSpacePress: () => console.log('⚠️ Drawer context not available'),
      registerEditSpaceHandler: () => console.log('⚠️ Drawer context not available'),
      onNavigateToSpace: () => console.log('⚠️ Drawer context not available'),
      registerNavigateToSpaceHandler: () => console.log('⚠️ Drawer context not available'),
      onNavigateToEverything: () => console.log('⚠️ Drawer context not available'),
      registerNavigateToEverythingHandler: () => console.log('⚠️ Drawer context not available'),
      onReorderSpacesPress: () => console.log('⚠️ Drawer context not available'),
      registerReorderSpacesHandler: () => console.log('⚠️ Drawer context not available'),
      currentView: null,
      setCurrentView: () => console.log('⚠️ Drawer context not available'),
    };
  }
  return context;
};

interface DrawerProviderProps {
  children: ReactNode;
}

export const DrawerProvider = ({ children }: DrawerProviderProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'everything' | 'spaces' | null>(null);
  const drawerRef = useRef<DrawerLayout>(null);
  const settingsHandlerRef = useRef<(() => void) | null>(null);
  const adminHandlerRef = useRef<(() => void) | null>(null);
  const tagManagerHandlerRef = useRef<(() => void) | null>(null);
  const createSpaceHandlerRef = useRef<(() => void) | null>(null);
  const editSpaceHandlerRef = useRef<((spaceId: string) => void) | null>(null);
  const navigateToSpaceHandlerRef = useRef<((spaceId: string) => void) | null>(null);
  const navigateToEverythingHandlerRef = useRef<(() => void) | null>(null);
  const reorderSpacesHandlerRef = useRef<(() => void) | null>(null);

  // Log when isDrawerOpen changes
  React.useEffect(() => {
    console.log('🎯 [DrawerContext] isDrawerOpen state changed to:', isDrawerOpen);
  }, [isDrawerOpen]);

  const openDrawer = useCallback(() => {
    const timestamp = new Date().toISOString();
    console.log('🍔 [DrawerContext] openDrawer called at:', timestamp);
    console.log('🍔 [DrawerContext] drawerRef.current:', drawerRef.current);
    console.log('🍔 [DrawerContext] Setting isDrawerOpen to true');

    // Log stack trace to see what called openDrawer
    console.log('🍔 [DrawerContext] openDrawer call stack:');
    console.trace();

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

  const registerAdminHandler = useCallback((handler: () => void) => {
    console.log('🔧 [DrawerContext] Registering admin handler');
    adminHandlerRef.current = handler;
  }, []);

  const onAdminPress = useCallback(() => {
    console.log('🔧 [DrawerContext] onAdminPress called');
    console.log('🔧 [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before opening admin
    setTimeout(() => {
      if (adminHandlerRef.current) {
        console.log('🔧 [DrawerContext] Calling registered admin handler');
        adminHandlerRef.current();
      } else {
        console.warn('⚠️ [DrawerContext] No admin handler registered');
      }
    }, 300); // Match drawer animation duration
  }, []);

  const registerTagManagerHandler = useCallback((handler: () => void) => {
    console.log('🏷️ [DrawerContext] Registering tag manager handler');
    tagManagerHandlerRef.current = handler;
  }, []);

  const onTagManagerPress = useCallback(() => {
    console.log('🏷️ [DrawerContext] onTagManagerPress called');
    console.log('🏷️ [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before opening tag manager
    setTimeout(() => {
      if (tagManagerHandlerRef.current) {
        console.log('🏷️ [DrawerContext] Calling registered tag manager handler');
        tagManagerHandlerRef.current();
      } else {
        console.warn('⚠️ [DrawerContext] No tag manager handler registered');
      }
    }, 300); // Match drawer animation duration
  }, []);

  const registerCreateSpaceHandler = useCallback((handler: () => void) => {
    console.log('➕ [DrawerContext] Registering create space handler');
    createSpaceHandlerRef.current = handler;
  }, []);

  const onCreateSpacePress = useCallback(() => {
    console.log('➕ [DrawerContext] onCreateSpacePress called');
    console.log('➕ [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before opening create space sheet
    setTimeout(() => {
      if (createSpaceHandlerRef.current) {
        console.log('➕ [DrawerContext] Calling registered create space handler');
        createSpaceHandlerRef.current();
      } else {
        console.warn('⚠️ [DrawerContext] No create space handler registered');
      }
    }, 300); // Match drawer animation duration
  }, []);

  const registerEditSpaceHandler = useCallback((handler: (spaceId: string) => void) => {
    console.log('✏️ [DrawerContext] Registering edit space handler');
    editSpaceHandlerRef.current = handler;
  }, []);

  const onEditSpacePress = useCallback((spaceId: string) => {
    console.log('✏️ [DrawerContext] onEditSpacePress called for space:', spaceId);
    console.log('✏️ [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before opening edit space sheet
    setTimeout(() => {
      if (editSpaceHandlerRef.current) {
        console.log('✏️ [DrawerContext] Calling registered edit space handler');
        editSpaceHandlerRef.current(spaceId);
      } else {
        console.warn('⚠️ [DrawerContext] No edit space handler registered');
      }
    }, 300); // Match drawer animation duration
  }, []);

  const registerNavigateToSpaceHandler = useCallback((handler: (spaceId: string) => void) => {
    // console.log('🧭 [DrawerContext] Registering navigate to space handler');
    navigateToSpaceHandlerRef.current = handler;
  }, []);

  const onNavigateToSpace = useCallback((spaceId: string) => {
    // console.log('🧭 [DrawerContext] onNavigateToSpace called for space:', spaceId);
    console.log('🧭 [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before navigating to space
    setTimeout(() => {
      if (navigateToSpaceHandlerRef.current) {
        // console.log('🧭 [DrawerContext] Calling registered navigate to space handler');
        navigateToSpaceHandlerRef.current(spaceId);
      } else {
        console.warn('⚠️ [DrawerContext] No navigate to space handler registered');
      }
    }, 300); // Match drawer animation duration
  }, []);

  const registerNavigateToEverythingHandler = useCallback((handler: () => void) => {
    // console.log('🧭 [DrawerContext] Registering navigate to EVERYTHING handler');
    navigateToEverythingHandlerRef.current = handler;
  }, []);

  const onNavigateToEverything = useCallback(() => {
    // console.log('🧭 [DrawerContext] onNavigateToEverything called');
    console.log('🧭 [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before navigating to Everything
    setTimeout(() => {
      if (navigateToEverythingHandlerRef.current) {
        // console.log('🧭 [DrawerContext] Calling registered navigate to EVERYTHING handler');
        navigateToEverythingHandlerRef.current();
      } else {
        console.warn('⚠️ [DrawerContext] No navigate to EVERYTHING handler registered');
      }
    }, 300); // Match drawer animation duration
  }, []);

  const registerReorderSpacesHandler = useCallback((handler: () => void) => {
    console.log('🔄 [DrawerContext] Registering reorder spaces handler');
    reorderSpacesHandlerRef.current = handler;
  }, []);

  const onReorderSpacesPress = useCallback(() => {
    console.log('🔄 [DrawerContext] onReorderSpacesPress called');
    console.log('🔄 [DrawerContext] Closing drawer');
    setIsDrawerOpen(false);

    // Wait for drawer to close before opening reorder sheet
    setTimeout(() => {
      if (reorderSpacesHandlerRef.current) {
        console.log('🔄 [DrawerContext] Calling registered reorder spaces handler');
        reorderSpacesHandlerRef.current();
      } else {
        console.warn('⚠️ [DrawerContext] No reorder spaces handler registered');
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
    onAdminPress,
    registerAdminHandler,
    onTagManagerPress,
    registerTagManagerHandler,
    onCreateSpacePress,
    registerCreateSpaceHandler,
    onEditSpacePress,
    registerEditSpaceHandler,
    onNavigateToSpace,
    registerNavigateToSpaceHandler,
    onNavigateToEverything,
    registerNavigateToEverythingHandler,
    onReorderSpacesPress,
    registerReorderSpacesHandler,
    currentView,
    setCurrentView,
  };

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
};
