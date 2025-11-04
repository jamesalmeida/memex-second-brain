import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
  isDarkMode: boolean;
}

/**
 * Reusable loading overlay component that overlays its parent component.
 * Shows a loading spinner with customizable text.
 * Note: This is NOT a Modal component - it's an absolute positioned overlay.
 *
 * @param visible - Controls whether the overlay is shown
 * @param text - Custom text to display (e.g., "Loading...", "Saving...", "Deleting...")
 * @param isDarkMode - Whether dark mode is enabled
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  text = 'Loading...',
  isDarkMode,
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.overlay, isDarkMode && styles.overlayDark]}>
      <View style={[styles.content, isDarkMode && styles.contentDark]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#007AFF'} />
        <Text style={[styles.text, isDarkMode && styles.textDark]}>
          {text}
        </Text>
      </View>
    </View>
  );
};

export default LoadingOverlay;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayDark: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  contentDark: {
    backgroundColor: '#2C2C2E',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
});
