import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { COLORS, UI } from '../constants';

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightComponent?: React.ReactNode;
  isDarkMode?: boolean;
  disabled?: boolean;
}

export function SettingsItem({
  title,
  subtitle,
  onPress,
  showArrow = true,
  rightComponent,
  isDarkMode = false,
  disabled = false,
}: SettingsItemProps) {
  const containerStyle = [
    styles.container,
    isDarkMode && styles.containerDark,
    disabled && styles.containerDisabled,
  ];

  const titleStyle = [
    styles.title,
    isDarkMode && styles.titleDark,
    disabled && styles.titleDisabled,
  ];

  const subtitleStyle = [
    styles.subtitle,
    isDarkMode && styles.subtitleDark,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={titleStyle}>{title}</Text>
          {subtitle && <Text style={subtitleStyle}>{subtitle}</Text>}
        </View>

        {rightComponent || (showArrow && onPress && (
          <Text style={[styles.arrow, isDarkMode && styles.arrowDark]}>›</Text>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background.light,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    paddingHorizontal: UI.SPACING.md,
    paddingVertical: UI.SPACING.md,
  },
  containerDark: {
    backgroundColor: COLORS.background.dark,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.light,
  },
  titleDark: {
    color: COLORS.text.dark,
  },
  titleDisabled: {
    color: COLORS.border.light,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  subtitleDark: {
    color: '#AAA',
  },
  arrow: {
    fontSize: 20,
    color: COLORS.text.light,
    marginLeft: UI.SPACING.sm,
  },
  arrowDark: {
    color: COLORS.text.dark,
  },
});
