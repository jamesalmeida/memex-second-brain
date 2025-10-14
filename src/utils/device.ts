import { Platform, useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

/**
 * Detect if the current device is an iPad
 */
export const isIPad = (): boolean => {
  return Platform.OS === 'ios' && Platform.isPad;
};

/**
 * Hook to get device type and orientation information
 */
export const useDeviceType = () => {
  const { width, height } = useWindowDimensions();
  
  return useMemo(() => {
    const isIPadDevice = isIPad();
    const isLandscape = width > height;
    
    return {
      isIPad: isIPadDevice,
      isLandscape,
      screenWidth: width,
      screenHeight: height,
      isPersistentDrawer: isIPadDevice && isLandscape, // Split-view drawer for iPad landscape
    };
  }, [width, height]);
};

/**
 * Get the number of grid columns based on available width
 * Accounts for iPadOS multitasking and responsive layout
 * 
 * Target column counts:
 * - iPad Landscape with drawer (~744px): 3 columns
 * - iPad Landscape without drawer (~1024px): 4 columns
 * - iPad Portrait (~768px): 3 columns
 * - Mobile (~390px): 2 columns
 * 
 * @param availableWidth - The actual measured width available for content
 * @param isDrawerVisible - Whether the drawer is currently visible
 * @param isPersistentDrawer - Whether we're in iPad landscape split-view mode
 */
export const getGridColumns = (
  availableWidth: number,
  isDrawerVisible: boolean = true,
  isPersistentDrawer: boolean = false
): number => {
  // iPad landscape with drawer visible: force 3 columns
  // (drawer takes 280px, leaving ~744px which should be 3 columns)
  if (isPersistentDrawer && isDrawerVisible && availableWidth > 700 && availableWidth < 900) {
    return 3;
  }
  
  // Define minimum width per column for good UX (240px gives us the right breakpoints)
  // This ensures items don't get too cramped while hitting our target column counts
  const MIN_COLUMN_WIDTH = 240;
  
  // Calculate max columns that fit comfortably based on actual container width
  const maxColumns = Math.floor(availableWidth / MIN_COLUMN_WIDTH);
  
  // Clamp between 2 and 4 columns (iPad max is 4, mobile min is 2)
  return Math.max(2, Math.min(4, maxColumns));
};

