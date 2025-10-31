import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isDarkMode: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  disabled = false,
  isDarkMode,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button];

    if (disabled) {
      baseStyle.push(styles.buttonDisabled);
      if (isDarkMode) baseStyle.push(styles.buttonDisabledDark);
    } else {
      switch (variant) {
        case 'primary':
          baseStyle.push(styles.buttonPrimary);
          if (isDarkMode) baseStyle.push(styles.buttonPrimaryDark);
          break;
        case 'secondary':
          baseStyle.push(styles.buttonSecondary);
          if (isDarkMode) baseStyle.push(styles.buttonSecondaryDark);
          break;
        case 'danger':
          baseStyle.push(styles.buttonDanger);
          if (isDarkMode) baseStyle.push(styles.buttonDangerDark);
          break;
      }
    }

    if (style) baseStyle.push(style);
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText];

    if (disabled) {
      baseStyle.push(styles.buttonTextDisabled);
    } else {
      switch (variant) {
        case 'primary':
          baseStyle.push(styles.buttonTextPrimary);
          break;
        case 'secondary':
          baseStyle.push(styles.buttonTextSecondary);
          if (isDarkMode) baseStyle.push(styles.buttonTextSecondaryDark);
          break;
        case 'danger':
          baseStyle.push(styles.buttonTextDanger);
          break;
      }
    }

    if (textStyle) baseStyle.push(textStyle);
    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={getTextStyle()}>{label}</Text>
    </TouchableOpacity>
  );
};

export default ActionButton;

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonPrimaryDark: {
    backgroundColor: '#0A84FF',
  },
  buttonSecondary: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  buttonSecondaryDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonDangerDark: {
    backgroundColor: '#FF453A',
  },
  buttonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  buttonDisabledDark: {
    backgroundColor: '#3A3A3C',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
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
  buttonTextDisabled: {
    color: '#8E8E93',
  },
});
