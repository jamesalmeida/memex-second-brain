import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SectionHeaderProps {
  label: string;
  isDarkMode: boolean;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  style?: any;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  isDarkMode,
  rightElement,
  onPress,
  style,
}) => {
  const content = (
    <View style={[styles.header, style]}>
      <Text style={[styles.label, isDarkMode && styles.labelDark]}>
        {label}
      </Text>
      {rightElement}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default SectionHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelDark: {
    color: '#98989F',
  },
});
