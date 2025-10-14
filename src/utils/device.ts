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
 * Get the number of grid columns based on device type and orientation
 */
export const getGridColumns = (isIPad: boolean, isLandscape: boolean): number => {
  if (!isIPad) {
    return 2; // Mobile: always 2 columns
  }
  
  return isLandscape ? 4 : 3; // iPad: 4 in landscape, 3 in portrait
};

