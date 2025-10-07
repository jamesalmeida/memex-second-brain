import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useRadialMenu } from '../../contexts/RadialMenuContext';
import { Item } from '../../types';

const LONG_PRESS_DURATION = 200; // ms

interface RadialActionMenuProps {
  item: Item;
  onPress?: (item: Item) => void;
  children: React.ReactNode;
  disabled?: boolean; // Disable wrapper for floating clones
}

const RadialActionMenu: React.FC<RadialActionMenuProps> = ({ item, onPress, children, disabled = false }) => {
  const { showMenu, hideMenu, updateHoveredButton, executeAction, isMenuVisible, activeItemId } = useRadialMenu();

  // If disabled, just render children without wrapper
  if (disabled) {
    return <>{children}</>;
  }

  // Check if THIS specific item has the menu open
  const isThisItemActive = activeItemId === item.id;
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const menuWasVisible = useRef(false);
  const touchStartTime = useRef(0);
  const isLongPressing = useRef(false); // Track if we're in the middle of handling a long press
  const wasCancelled = useRef(false); // Track if long press was cancelled due to movement
  const cardRef = useRef<any>(null);

  // Animated values for card
  const cardScale = useSharedValue(1);
  const cardRotate = useSharedValue(0);

  const handleTouchStart = useCallback((event: any) => {
    console.log('🔵 Touch Start');
    const touch = event.nativeEvent.touches[0];
    touchStart.current = { x: touch.pageX, y: touch.pageY };
    touchStartTime.current = Date.now();
    menuWasVisible.current = false;
    isLongPressing.current = true; // Mark that we're potentially long pressing
    wasCancelled.current = false; // Reset cancellation flag

    // Start long-press timer
    longPressTimer.current = setTimeout(() => {
      console.log('⏰ Long press triggered!');
      cardScale.value = withSpring(1.05);
      cardRotate.value = withSpring(2);
      menuWasVisible.current = true;

      // Measure card position before showing menu
      if (cardRef.current) {
        cardRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
          // console.log('📏 Card measured at:', { x, y, width, height });
          showMenu(item, touch.pageX, touch.pageY, { x, y, width, height });
        });
      }
    }, LONG_PRESS_DURATION);
  }, [item, showMenu, cardScale, cardRotate]);

  const handleTouchMove = useCallback((event: any) => {
    const touch = event.nativeEvent.touches[0];

    if (!menuWasVisible.current && !isMenuVisible) {
      // We're still waiting for long press - check if finger moved too much
      const distance = Math.sqrt(
        Math.pow(touch.pageX - touchStart.current.x, 2) +
        Math.pow(touch.pageY - touchStart.current.y, 2)
      );

      if (distance > 20 && longPressTimer.current) {
        // console.log('❌ Long press cancelled - finger moved too much:', distance);
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        isLongPressing.current = false;
        wasCancelled.current = true; // Mark as cancelled to prevent tap handler
      }
    } else {
      // Menu is visible - update hovered button
      updateHoveredButton(touch.pageX, touch.pageY);
    }
  }, [isMenuVisible, updateHoveredButton]);

  const handleTouchEnd = useCallback(() => {
    // Clear long-press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (menuWasVisible.current && isMenuVisible) {
      // Execute action first
      executeAction();

      // Reset card animation
      cardScale.value = withSpring(1);
      cardRotate.value = withSpring(0);

      // Hide menu
      hideMenu();
      menuWasVisible.current = false;
      isLongPressing.current = false;
    } else if (!menuWasVisible.current && !isMenuVisible && !wasCancelled.current) {
      // This was a regular tap (not a long press and not cancelled by scrolling)
      const touchDuration = Date.now() - touchStartTime.current;

      // If touch was quick and didn't move much, treat as tap
      if (touchDuration < LONG_PRESS_DURATION && onPress) {
        console.log('👆 Regular tap detected');
        onPress(item);
      }
      isLongPressing.current = false;
    }
  }, [isMenuVisible, executeAction, hideMenu, cardScale, cardRotate, onPress, item]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (menuWasVisible.current) {
      cardScale.value = withSpring(1);
      cardRotate.value = withSpring(0);
      hideMenu();
      menuWasVisible.current = false;
    }
    isLongPressing.current = false;
    wasCancelled.current = true;
  }, [hideMenu, cardScale, cardRotate]);

  // Use responder system to capture touches when menu is visible
  const onStartShouldSetResponder = useCallback(() => {
    return true; // Claim initial touch
  }, []);

  const onStartShouldSetResponderCapture = useCallback(() => {
    // Capture touches before children get them
    return true;
  }, []);

  const onMoveShouldSetResponder = useCallback(() => {
    // Only claim moves when menu is actually visible
    return menuWasVisible.current || isMenuVisible;
  }, [isMenuVisible]);

  const onMoveShouldSetResponderCapture = useCallback(() => {
    // Only capture move events when menu is active
    return menuWasVisible.current || isMenuVisible;
  }, [isMenuVisible]);

  const onResponderGrant = useCallback((event: any) => {
    handleTouchStart(event);
  }, [handleTouchStart]);

  const onResponderMove = useCallback((event: any) => {
    handleTouchMove(event);
  }, [handleTouchMove]);

  const onResponderRelease = useCallback((event: any) => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  const onResponderTerminate = useCallback(() => {
    handleTouchCancel();
  }, [handleTouchCancel]);

  // Animated styles
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { rotate: `${cardRotate.value}deg` },
    ],
    opacity: isThisItemActive ? 0 : 1, // Hide THIS card when its menu is open
  }));

  return (
    <Animated.View
      ref={cardRef}
      style={[
        styles.container,
        cardStyle,
        // Add glow when THIS item's menu is open
        isThisItemActive && styles.cardGlow,
      ]}
      onStartShouldSetResponder={onStartShouldSetResponder}
      onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}
      onMoveShouldSetResponder={onMoveShouldSetResponder}
      onMoveShouldSetResponderCapture={onMoveShouldSetResponderCapture}
      onResponderGrant={onResponderGrant}
      onResponderMove={onResponderMove}
      onResponderRelease={onResponderRelease}
      onResponderTerminate={onResponderTerminate}
      onResponderTerminationRequest={() => {
        // Only prevent termination if menu is actually visible
        return !(menuWasVisible.current || isMenuVisible);
      }}
    >
      {children}
    </Animated.View>
  );
};

export default RadialActionMenu;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000, // Ensure card is above other content
  },
  cardGlow: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 999,
  },
});
