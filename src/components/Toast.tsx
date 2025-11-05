import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
  isDarkMode?: boolean;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 2500,
  onDismiss,
  isDarkMode = false,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const gestureTranslateY = useSharedValue(0);

  useEffect(() => {
    // Slide in
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, { duration: 200 });

    // Auto dismiss
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const dismiss = () => {
    translateY.value = withTiming(-100, { duration: 250 });
    opacity.value = withTiming(0, { duration: 250 }, () => {
      if (onDismiss) {
        runOnJS(onDismiss)();
      }
    });
  };

  // Pan gesture for swipe-to-dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow upward swipes (negative translationY)
      if (event.translationY < 0) {
        gestureTranslateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      const DISMISS_THRESHOLD = -50; // Swipe up at least 50px to dismiss

      if (event.translationY < DISMISS_THRESHOLD) {
        // Swipe was far enough - dismiss the toast
        gestureTranslateY.value = withTiming(-150, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          if (onDismiss) {
            runOnJS(onDismiss)();
          }
        });
      } else {
        // Swipe wasn't far enough - snap back
        gestureTranslateY.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + gestureTranslateY.value }],
    opacity: opacity.value,
  }));

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <MaterialIcons name="check-circle" size={20} color="#4CAF50" />;
      case 'error':
        return <MaterialIcons name="error" size={20} color="#F44336" />;
      case 'warning':
        return <MaterialIcons name="warning" size={20} color="#FF9800" />;
      case 'info':
      default:
        return <MaterialIcons name="info" size={20} color="#2196F3" />;
    }
  };

  const getBackgroundColor = () => {
    if (isDarkMode) {
      switch (type) {
        case 'success':
          return '#1B5E20';
        case 'error':
          return '#B71C1C';
        case 'warning':
          return '#E65100';
        case 'info':
        default:
          return '#0D47A1';
      }
    } else {
      switch (type) {
        case 'success':
          return '#E8F5E9';
        case 'error':
          return '#FFEBEE';
        case 'warning':
          return '#FFF3E0';
        case 'info':
        default:
          return '#E3F2FD';
      }
    }
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          {
            top: insets.top + 10,
            backgroundColor: getBackgroundColor(),
          },
          animatedStyle,
        ]}
      >
        <View style={styles.content}>
          {getIcon()}
          <Text
            style={[
              styles.message,
              isDarkMode ? styles.messageDark : styles.messageLight,
            ]}
            numberOfLines={2}
          >
            {message}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
    marginTop: 32,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  messageLight: {
    color: '#1C1C1E',
  },
  messageDark: {
    color: '#FFFFFF',
  },
});

export default Toast;
