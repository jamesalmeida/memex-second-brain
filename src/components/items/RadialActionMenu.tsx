import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useRadialMenu } from '../../contexts/RadialMenuContext';
import { Item } from '../../types';

const LONG_PRESS_DURATION = 500; // ms

interface RadialActionMenuProps {
  item: Item;
  onPress?: (item: Item) => void;
  children: React.ReactNode;
}

const RadialActionMenu: React.FC<RadialActionMenuProps> = ({ item, onPress, children }) => {
  const { showMenu, hideMenu, updateHoveredButton, executeAction, isMenuVisible } = useRadialMenu();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const menuWasVisible = useRef(false);
  const touchStartTime = useRef(0);
  const isLongPressing = useRef(false); // Track if we're in the middle of handling a long press

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

    // Start long-press timer
    longPressTimer.current = setTimeout(() => {
      console.log('⏰ Long press triggered!');
      cardScale.value = withSpring(1.05);
      cardRotate.value = withSpring(2);
      menuWasVisible.current = true;
      showMenu(item, touch.pageX, touch.pageY);
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

      if (distance > 10 && longPressTimer.current) {
        console.log('❌ Long press cancelled - finger moved too much:', distance);
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        isLongPressing.current = false;
      }
    } else {
      // Menu is visible - update hovered button
      console.log('👆 Touch Move - updating hover at:', touch.pageX, touch.pageY);
      updateHoveredButton(touch.pageX, touch.pageY);
    }
  }, [isMenuVisible, updateHoveredButton]);

  const handleTouchEnd = useCallback(() => {
    console.log('🔴 Touch End - menuWasVisible:', menuWasVisible.current, 'isMenuVisible:', isMenuVisible);

    // Clear long-press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (menuWasVisible.current && isMenuVisible) {
      console.log('✅ Executing action and hiding menu');

      // Execute action first
      executeAction();

      // Reset card animation
      cardScale.value = withSpring(1);
      cardRotate.value = withSpring(0);

      // Hide menu
      hideMenu();
      menuWasVisible.current = false;
      isLongPressing.current = false;
    } else if (!menuWasVisible.current && !isMenuVisible) {
      // This was a regular tap (not a long press)
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
    console.log('⚠️ Touch Cancelled - this should NOT happen if we prevent parent scroll!');

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
  }, [hideMenu, cardScale, cardRotate]);

  // Use responder system to capture touches when menu is visible
  const onStartShouldSetResponder = useCallback(() => {
    return true; // Always claim touch events
  }, []);

  const onStartShouldSetResponderCapture = useCallback(() => {
    // Capture touches before children (TouchableOpacity) get them
    console.log('🎯 Capture phase - stealing touch from children');
    return true;
  }, []);

  const onMoveShouldSetResponder = useCallback(() => {
    const shouldClaim = isLongPressing.current || menuWasVisible.current || isMenuVisible;
    console.log('🤔 onMoveShouldSetResponder - claiming:', shouldClaim, '(longPress:', isLongPressing.current, 'wasVisible:', menuWasVisible.current, 'visible:', isMenuVisible, ')');
    return shouldClaim;
  }, [isMenuVisible]);

  const onMoveShouldSetResponderCapture = useCallback(() => {
    // Aggressively capture move events when menu is active
    const shouldCapture = isLongPressing.current || menuWasVisible.current || isMenuVisible;
    console.log('🛑 onMoveShouldSetResponderCapture - capturing:', shouldCapture);
    return shouldCapture;
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
  }));

  return (
    <Animated.View
      style={[styles.container, cardStyle]}
      onStartShouldSetResponder={onStartShouldSetResponder}
      onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}
      onMoveShouldSetResponder={onMoveShouldSetResponder}
      onMoveShouldSetResponderCapture={onMoveShouldSetResponderCapture}
      onResponderGrant={onResponderGrant}
      onResponderMove={onResponderMove}
      onResponderRelease={onResponderRelease}
      onResponderTerminate={onResponderTerminate}
      onResponderTerminationRequest={(e) => {
        // NEVER let parent steal responder if menu was triggered or is visible
        const shouldKeep = isLongPressing.current || menuWasVisible.current || isMenuVisible;
        console.log('⚠️⚠️⚠️ Parent (ScrollView) wants to steal responder!');
        console.log('   - isLongPressing:', isLongPressing.current);
        console.log('   - menuWasVisible:', menuWasVisible.current);
        console.log('   - isMenuVisible:', isMenuVisible);
        console.log('   - Decision: DENYING termination request!');
        return false; // ALWAYS deny - never let parent take over
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
  },
});
