import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, UI } from '../constants';

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

export function SettingsSection({ title, children, isDarkMode = false }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      {title && (
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          {title}
        </Text>
      )}
      <View style={[styles.sectionContent, isDarkMode && styles.sectionContentDark]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: UI.SPACING.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: UI.SPACING.sm,
    marginHorizontal: UI.SPACING.md,
  },
  sectionTitleDark: {
    color: '#AAA',
  },
  sectionContent: {
    backgroundColor: COLORS.background.light,
    borderRadius: UI.BORDER_RADIUS,
    overflow: 'hidden',
  },
  sectionContentDark: {
    backgroundColor: COLORS.background.dark,
  },
});
