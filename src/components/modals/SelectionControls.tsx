import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface RadioButtonProps {
  selected: boolean;
  color?: string;
  style?: ViewStyle;
}

/**
 * Reusable radio button component for single selection lists.
 * Can be customized with a color when selected (e.g., for space colors).
 */
export const RadioButton: React.FC<RadioButtonProps> = ({
  selected,
  color = '#007AFF',
  style,
}) => {
  return (
    <View
      style={[
        styles.radioButton,
        selected && styles.radioButtonSelected,
        selected && { borderColor: color },
        style,
      ]}
    >
      {selected && (
        <View style={[styles.radioButtonInner, { backgroundColor: color }]} />
      )}
    </View>
  );
};

interface CheckboxProps {
  selected: boolean;
  color?: string;
  style?: ViewStyle;
}

/**
 * Reusable checkbox component for multi-selection lists.
 * Shows a checkmark icon when selected with customizable background color.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  selected,
  color = '#007AFF',
  style,
}) => {
  return (
    <View
      style={[
        styles.checkbox,
        selected && styles.checkboxSelected,
        selected && { backgroundColor: color, borderColor: color },
        style,
      ]}
    >
      {selected && (
        <MaterialIcons name="check" size={16} color="#FFFFFF" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderWidth: 2,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderWidth: 0,
  },
});
