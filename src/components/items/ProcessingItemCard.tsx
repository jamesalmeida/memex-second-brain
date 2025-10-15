import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';

interface ProcessingItemCardProps {
  title?: string;
}

const ProcessingItemCard = observer(({ title }: ProcessingItemCardProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const pulse = new Animated.Value(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View style={[styles.shadowContainer, isDarkMode && styles.shadowContainerDark, { transform: [{ scale }] }]}> 
      <View style={[styles.card, isDarkMode && styles.cardDark]}> 
        <View style={[styles.placeholder, isDarkMode && styles.placeholderDark]}> 
          <Animated.View style={[styles.pulseBar, { opacity }]} />
          <Text style={[styles.processingText, isDarkMode && styles.processingTextDark]}>Processing…</Text>
          {title ? (
            <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={1}>{title}</Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
});

export default ProcessingItemCard;

const styles = StyleSheet.create({
  shadowContainer: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  shadowContainerDark: {
    shadowOpacity: 0.4,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  placeholder: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  placeholderDark: {
    backgroundColor: '#2C2C2E',
  },
  pulseBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#FF6B35',
  },
  processingText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  processingTextDark: {
    color: '#AAAAAA',
  },
  title: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    paddingHorizontal: 12,
  },
  titleDark: {
    color: '#FFFFFF',
  },
});


