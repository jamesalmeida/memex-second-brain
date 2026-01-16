import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface EnrichingOverlayProps {
  visible: boolean;
  isDarkMode: boolean;
  message?: string;
}

/**
 * Overlay component shown on sections that are still being enriched
 * Displays a pulsing "Processing..." indicator and blocks user interaction
 */
const EnrichingOverlay: React.FC<EnrichingOverlayProps> = ({
  visible,
  isDarkMode,
  message = 'Processing...',
}) => {
  const pulseAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [visible, pulseAnim]);

  if (!visible) return null;

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <View style={[styles.overlay, isDarkMode && styles.overlayDark]}>
      <Animated.View style={[styles.content, { opacity }]}>
        <View style={[styles.indicator, isDarkMode && styles.indicatorDark]} />
        <Text style={[styles.text, isDarkMode && styles.textDark]}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  overlayDark: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9500',
    marginRight: 8,
  },
  indicatorDark: {
    backgroundColor: '#FF9F0A',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  textDark: {
    color: '#EBEBF5',
  },
});

export default EnrichingOverlay;
