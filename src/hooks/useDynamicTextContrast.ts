import { useState, useCallback, useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

interface ContrastConfig {
  lightThreshold?: number;
  darkThreshold?: number;
  transitionDuration?: number;
  scrollSampleRate?: number;
}

const DEFAULT_CONFIG: ContrastConfig = {
  lightThreshold: 0.5,
  darkThreshold: 0.5,
  transitionDuration: 200,
  scrollSampleRate: 100,
};

export const useDynamicTextContrast = (
  isDarkMode: boolean,
  config: ContrastConfig = {}
) => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  // Initial state: in light mode we need dark text, in dark mode we need light text
  const [shouldUseDarkText, setShouldUseDarkText] = useState(!isDarkMode);
  const scrollY = useRef(0);
  const lastSampleTime = useRef(0);
  
  // Initial value: 0 = dark text, 1 = light text
  // In light mode, start with dark text (0)
  // In dark mode, start with light text (1)
  const textColorValue = useSharedValue(isDarkMode ? 1 : 0);

  const calculateOptimalTextColor = useCallback((scrollOffset: number, itemData?: any[]) => {
    const now = Date.now();
    if (now - lastSampleTime.current < mergedConfig.scrollSampleRate!) {
      return;
    }
    lastSampleTime.current = now;

    // When scrollOffset is 0 (top of page), we see the initial content
    // In your app, the initial view shows light-colored item cards in light mode
    // and dark-colored cards in dark mode
    
    // Calculate the brightness of content behind the search bar
    let averageBrightness;
    
    // At scroll position 0 (initial load)
    if (scrollOffset < 50) {
      // Light mode: light background → brightness is high (0.9)
      // Dark mode: dark background → brightness is low (0.1)
      averageBrightness = isDarkMode ? 0.1 : 0.9;
    } else {
      // As user scrolls, simulate varying content brightness
      const itemHeight = 200; // Average item card height
      
      if (isDarkMode) {
        // In dark mode, cards are dark but may have bright images
        const brightnessCycle = Math.sin((scrollOffset / itemHeight) * Math.PI * 0.5);
        averageBrightness = 0.2 + (brightnessCycle * 0.4); // Range: 0.2 to 0.6
      } else {
        // In light mode, cards are generally light with varying images
        const brightnessCycle = Math.sin((scrollOffset / itemHeight) * Math.PI * 0.5);
        averageBrightness = 0.7 + (brightnessCycle * 0.2); // Range: 0.5 to 0.9
      }
      
      // Add some variation based on exact scroll position
      const microVariation = Math.sin(scrollOffset * 0.05) * 0.1;
      averageBrightness = Math.max(0, Math.min(1, averageBrightness + microVariation));
    }

    // Determine text color based on background brightness
    // Bright background (> 0.5) → use dark text (true)
    // Dark background (<= 0.5) → use light text (false)
    const targetUseDarkText = averageBrightness > 0.5;

    if (targetUseDarkText !== shouldUseDarkText) {
      setShouldUseDarkText(targetUseDarkText);
      // textColorValue: 0 = dark text, 1 = light text
      // When targetUseDarkText is true, we want dark text (0)
      // When targetUseDarkText is false, we want light text (1)
      textColorValue.value = withTiming(targetUseDarkText ? 0 : 1, {
        duration: mergedConfig.transitionDuration,
      });
    }
  }, [isDarkMode, shouldUseDarkText, textColorValue, mergedConfig]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    'worklet';
    const offset = event.nativeEvent.contentOffset.y;
    runOnJS(calculateOptimalTextColor)(offset);
  }, [calculateOptimalTextColor]);

  const animatedTextStyle = useAnimatedStyle(() => {
    // 0 = dark text, 1 = light text
    const color = interpolate(
      textColorValue.value,
      [0, 1],
      [0x00, 0xFF] // Always interpolate from black to white
    );
    
    const hexColor = Math.round(color).toString(16).padStart(2, '0');
    return {
      color: `#${hexColor}${hexColor}${hexColor}`,
    };
  });

  // For placeholder, we need to return just the color value, not a style object
  const getPlaceholderColor = () => {
    'worklet';
    const color = interpolate(
      textColorValue.value,
      [0, 1],
      [0x66, 0x99] // From dark gray to light gray
    );
    const hexColor = Math.round(color).toString(16).padStart(2, '0');
    return `#${hexColor}${hexColor}${hexColor}`;
  };

  useEffect(() => {
    // Calculate initial color on mount and theme changes
    calculateOptimalTextColor(0);
  }, [isDarkMode, calculateOptimalTextColor]);

  return {
    handleScroll,
    animatedTextStyle,
    shouldUseDarkText,
    textColor: shouldUseDarkText ? '#000000' : '#FFFFFF',
    placeholderColor: shouldUseDarkText ? '#666666' : '#999999',
  };
};