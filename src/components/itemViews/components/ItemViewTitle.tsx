import React from 'react';
import { StyleSheet, TextStyle } from 'react-native';
import InlineEditableText from '../../InlineEditableText';

interface ItemViewTitleProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  isDarkMode: boolean;
  placeholder?: string;
  style?: TextStyle;
}

const ItemViewTitle: React.FC<ItemViewTitleProps> = ({
  value,
  onSave,
  isDarkMode,
  placeholder = 'Tap to add title',
  style,
}) => {
  return (
    <InlineEditableText
      value={value}
      placeholder={placeholder}
      onSave={onSave}
      style={[styles.title, isDarkMode && styles.titleDark, style]}
      isDarkMode={isDarkMode}
    />
  );
};

export default ItemViewTitle;

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  titleDark: {
    color: '#FFFFFF',
  },
});
