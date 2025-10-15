import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { observer } from '@legendapp/state/react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, Easing } from 'react-native-reanimated';

interface TypingIndicatorProps {
  isDarkMode: boolean;
}

const TypingIndicator = observer(({ isDarkMode }: TypingIndicatorProps) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (dot: Animated.SharedValue<number>, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-8, { duration: 400, easing: Easing.ease }),
            withTiming(0, { duration: 400, easing: Easing.ease })
          ),
          -1,
          false
        )
      );
    };

    animateDot(dot1, 0);
    animateDot(dot2, 133);
    animateDot(dot3, 266);
  }, []);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));

  const animatedStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  return (
    <View style={styles.typingContainer}>
      <View style={[styles.typingBubble, isDarkMode && styles.typingBubbleDark]}>
        <Animated.View style={[styles.typingDot, animatedStyle1]} />
        <Animated.View style={[styles.typingDot, animatedStyle2]} />
        <Animated.View style={[styles.typingDot, animatedStyle3]} />
      </View>
    </View>
  );
});

export default TypingIndicator;

const styles = StyleSheet.create({
  typingContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  typingBubble: {
    backgroundColor: '#E9E9EB',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingBubbleDark: {
    backgroundColor: '#3A3A3C',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999999',
  },
});


