import React from 'react';
import { View, StyleSheet } from 'react-native';
import InlineEditableText from '../../InlineEditableText';
import SectionHeader from './SectionHeader';

interface ItemViewDescriptionProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  isDarkMode: boolean;
  placeholder?: string;
  showLabel?: boolean;
  label?: string;
  maxLines?: number;
  collapsible?: boolean;
  collapsedLines?: number;
  showMoreThreshold?: number;
}

const ItemViewDescription: React.FC<ItemViewDescriptionProps> = ({
  value,
  onSave,
  isDarkMode,
  placeholder = 'Tap to add description',
  showLabel = true,
  label = 'DESCRIPTION',
  maxLines = 8,
  collapsible = true,
  collapsedLines = 6,
  showMoreThreshold = 300,
}) => {
  return (
    <View style={styles.section}>
      {showLabel && (
        <SectionHeader label={label} isDarkMode={isDarkMode} />
      )}
      <InlineEditableText
        value={value}
        placeholder={placeholder}
        onSave={onSave}
        style={[styles.text, isDarkMode && styles.textDark]}
        multiline
        maxLines={maxLines}
        collapsible={collapsible}
        collapsedLines={collapsedLines}
        showMoreThreshold={showMoreThreshold}
        isDarkMode={isDarkMode}
      />
    </View>
  );
};

export default ItemViewDescription;

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#000',
  },
  textDark: {
    color: '#FFFFFF',
  },
});
