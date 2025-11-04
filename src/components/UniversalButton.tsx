import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { useToast } from '../contexts/ToastContext';

export interface UniversalButtonProps {
  // Content
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';

  // Behavior
  onPress: () => void | Promise<void>;
  disabled?: boolean;

  // State
  loading?: boolean; // External loading control

  // Appearance
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;

  // Toast integration
  showToastOnSuccess?: boolean;
  successMessage?: string;
  errorMessage?: string;

  // Advanced
  hapticFeedback?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const UniversalButton: React.FC<UniversalButtonProps> = observer(({
  label,
  icon,
  iconPosition = 'left',
  onPress,
  disabled = false,
  loading: externalLoading = false,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  showToastOnSuccess = false,
  successMessage,
  errorMessage,
  hapticFeedback = true,
  style,
  textStyle,
}) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const { showToast } = useToast();
  const [internalLoading, setInternalLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Animation values
  const scale = useSharedValue(1);
  const checkmarkOpacity = useSharedValue(0);

  // Determine if button is in loading state
  const isLoading = externalLoading || internalLoading;

  // Determine if button should be disabled
  const isDisabled = disabled || isLoading || showSuccess;

  // Reset success state after animation
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        checkmarkOpacity.value = withTiming(0, { duration: 200 });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const handlePress = async () => {
    if (isDisabled) return;

    // Haptic feedback
    if (hapticFeedback) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Scale animation
    scale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );

    try {
      // Check if onPress is async
      const result = onPress();

      if (result instanceof Promise) {
        setInternalLoading(true);
        await result;
        setInternalLoading(false);

        // Show success state
        if (showToastOnSuccess || successMessage) {
          setShowSuccess(true);
          checkmarkOpacity.value = withSpring(1, { damping: 15 });

          if (showToastOnSuccess && successMessage) {
            showToast({
              message: successMessage,
              type: 'success',
            });
          }
        }
      }
    } catch (error) {
      setInternalLoading(false);

      // Show error toast if configured
      if (errorMessage) {
        showToast({
          message: errorMessage,
          type: 'error',
        });
      } else {
        showToast({
          message: 'An error occurred. Please try again.',
          type: 'error',
        });
      }

      console.error('Button action error:', error);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkmarkOpacity.value,
  }));

  const getButtonStyle = (): ViewStyle[] => {
    const baseStyles: ViewStyle[] = [styles.button];

    // Size styles
    switch (size) {
      case 'small':
        baseStyles.push(styles.buttonSmall);
        break;
      case 'large':
        baseStyles.push(styles.buttonLarge);
        break;
      default:
        baseStyles.push(styles.buttonMedium);
    }

    // Full width
    if (fullWidth) {
      baseStyles.push(styles.buttonFullWidth);
    }

    // Variant and state styles
    if (isDisabled) {
      baseStyles.push(styles.buttonDisabled);
      if (isDarkMode) baseStyles.push(styles.buttonDisabledDark);
    } else {
      switch (variant) {
        case 'primary':
          baseStyles.push(styles.buttonPrimary);
          if (isDarkMode) baseStyles.push(styles.buttonPrimaryDark);
          break;
        case 'secondary':
          baseStyles.push(styles.buttonSecondary);
          if (isDarkMode) baseStyles.push(styles.buttonSecondaryDark);
          break;
        case 'danger':
          baseStyles.push(styles.buttonDanger);
          if (isDarkMode) baseStyles.push(styles.buttonDangerDark);
          break;
        case 'ghost':
          baseStyles.push(styles.buttonGhost);
          if (isDarkMode) baseStyles.push(styles.buttonGhostDark);
          break;
      }
    }

    if (style) baseStyles.push(style);
    return baseStyles;
  };

  const getTextStyle = (): TextStyle[] => {
    const baseStyles: TextStyle[] = [styles.buttonText];

    // Size text styles
    switch (size) {
      case 'small':
        baseStyles.push(styles.buttonTextSmall);
        break;
      case 'large':
        baseStyles.push(styles.buttonTextLarge);
        break;
      default:
        baseStyles.push(styles.buttonTextMedium);
    }

    // Variant text styles
    if (isDisabled) {
      baseStyles.push(styles.buttonTextDisabled);
    } else {
      switch (variant) {
        case 'primary':
          baseStyles.push(styles.buttonTextPrimary);
          break;
        case 'secondary':
          baseStyles.push(styles.buttonTextSecondary);
          if (isDarkMode) baseStyles.push(styles.buttonTextSecondaryDark);
          break;
        case 'danger':
          baseStyles.push(styles.buttonTextDanger);
          break;
        case 'ghost':
          baseStyles.push(styles.buttonTextGhost);
          if (isDarkMode) baseStyles.push(styles.buttonTextGhostDark);
          break;
      }
    }

    if (textStyle) baseStyles.push(textStyle);
    return baseStyles;
  };

  const getIconColor = (): string => {
    if (isDisabled) return '#8E8E93';

    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
        return isDarkMode ? '#FFFFFF' : '#000000';
      case 'ghost':
        return isDarkMode ? '#FFFFFF' : '#007AFF';
      default:
        return '#FFFFFF';
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 22;
      default:
        return 18;
    }
  };

  const renderContent = () => {
    // Show checkmark if success state
    if (showSuccess) {
      return (
        <Animated.View style={[styles.contentRow, checkmarkAnimatedStyle]}>
          <MaterialIcons name="check-circle" size={getIconSize()} color={getIconColor()} />
          <Text style={getTextStyle()}>Success!</Text>
        </Animated.View>
      );
    }

    // Show loading spinner
    if (isLoading) {
      return (
        <View style={styles.contentRow}>
          <ActivityIndicator
            size={size === 'small' ? 'small' : 'small'}
            color={getIconColor()}
            style={styles.spinner}
          />
          <Text style={getTextStyle()}>Loading...</Text>
        </View>
      );
    }

    // Show normal content
    return (
      <View style={styles.contentRow}>
        {icon && iconPosition === 'left' && (
          <MaterialIcons
            name={icon}
            size={getIconSize()}
            color={getIconColor()}
            style={styles.iconLeft}
          />
        )}
        <Text style={getTextStyle()}>{label}</Text>
        {icon && iconPosition === 'right' && (
          <MaterialIcons
            name={icon}
            size={getIconSize()}
            color={getIconColor()}
            style={styles.iconRight}
          />
        )}
      </View>
    );
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{
          disabled: isDisabled,
          busy: isLoading,
        }}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
});

export default UniversalButton;

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonFullWidth: {
    width: '100%',
  },

  // Size variants
  buttonSmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
  },
  buttonMedium: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
  },
  buttonLarge: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    minWidth: 160,
  },

  // Primary variant
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonPrimaryDark: {
    backgroundColor: '#0A84FF',
  },

  // Secondary variant
  buttonSecondary: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  buttonSecondaryDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },

  // Danger variant
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonDangerDark: {
    backgroundColor: '#FF453A',
  },

  // Ghost variant
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonGhostDark: {
    borderColor: '#0A84FF',
  },

  // Disabled state
  buttonDisabled: {
    backgroundColor: '#E5E5EA',
    borderWidth: 0,
  },
  buttonDisabledDark: {
    backgroundColor: '#3A3A3C',
  },

  // Content layout
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text styles
  buttonText: {
    fontWeight: '600',
  },
  buttonTextSmall: {
    fontSize: 13,
  },
  buttonTextMedium: {
    fontSize: 14,
  },
  buttonTextLarge: {
    fontSize: 16,
  },

  // Text variant styles
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#000000',
  },
  buttonTextSecondaryDark: {
    color: '#FFFFFF',
  },
  buttonTextDanger: {
    color: '#FFFFFF',
  },
  buttonTextGhost: {
    color: '#007AFF',
  },
  buttonTextGhostDark: {
    color: '#0A84FF',
  },
  buttonTextDisabled: {
    color: '#8E8E93',
  },

  // Icon styles
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  spinner: {
    marginRight: 8,
  },
});
