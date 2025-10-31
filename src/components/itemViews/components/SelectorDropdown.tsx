import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SectionHeader from './SectionHeader';

interface SelectorDropdownProps {
  label: string;
  selectedLabel: string;
  placeholder?: string;
  onPress: () => void;
  isDarkMode: boolean;
  icon?: string;
  colorIndicator?: string;
}

const SelectorDropdown: React.FC<SelectorDropdownProps> = ({
  label,
  selectedLabel,
  placeholder = 'Select an option',
  onPress,
  isDarkMode,
  icon,
  colorIndicator,
}) => {
  const hasSelection = selectedLabel.length > 0;

  return (
    <View style={styles.section}>
      <SectionHeader label={label} isDarkMode={isDarkMode} />
      <TouchableOpacity
        style={[styles.selector, isDarkMode && styles.selectorDark]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {hasSelection ? (
          <View style={styles.selectedContent}>
            {colorIndicator && (
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: colorIndicator },
                ]}
              />
            )}
            {icon && <Text style={styles.icon}>{icon}</Text>}
            <Text
              style={[styles.selectedText, isDarkMode && styles.selectedTextDark]}
              numberOfLines={1}
            >
              {selectedLabel}
            </Text>
          </View>
        ) : (
          <Text style={[styles.placeholder, isDarkMode && styles.placeholderDark]}>
            {icon && `${icon} `}{placeholder}
          </Text>
        )}
        <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>▼</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SelectorDropdown;

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  selectorDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  selectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  icon: {
    fontSize: 16,
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  selectedTextDark: {
    color: '#FFFFFF',
  },
  placeholder: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  placeholderDark: {
    color: '#98989F',
  },
  chevron: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
  },
  chevronDark: {
    color: '#98989F',
  },
});
