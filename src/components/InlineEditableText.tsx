import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';

interface InlineEditableTextProps {
  value: string | undefined | null;
  placeholder?: string;
  onSave: (newValue: string) => Promise<void> | void;
  style?: any;
  multiline?: boolean;
  maxLines?: number;
  testID?: string;
  isDarkMode?: boolean;
  collapsible?: boolean;
  collapsedLines?: number;
  showMoreThreshold?: number; // min chars to show Show more/less
  numberOfLines?: number; // Force specific number of lines with ellipsis
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  hideEditIcon?: boolean; // Hide edit icon and controls for clean native input style
  placeholderTextColor?: string; // Custom placeholder color
}

const InlineEditableText: React.FC<InlineEditableTextProps> = ({
  value,
  placeholder = 'Tap to edit',
  onSave,
  style,
  multiline = false,
  maxLines,
  testID,
  isDarkMode,
  collapsible,
  collapsedLines,
  showMoreThreshold = 300,
  numberOfLines,
  ellipsizeMode = 'tail',
  hideEditIcon = true,
  placeholderTextColor,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing]);

  const beginEdit = () => {
    setDraft(value ?? '');
    setIsEditing(true);
    setJustSaved(false);
  };

  const cancelEdit = () => {
    setDraft(value ?? '');
    setIsEditing(false);
  };

  const saveValue = async (val: string) => {
    if (val === (value ?? '')) {
      return;
    }
    try {
      setIsSaving(true);
      await Promise.resolve(onSave(val));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdit = async () => {
    // Optimistically hide the input immediately on blur
    setIsEditing(false);
    await saveValue(draft);
  };

  const clearAndSave = async () => {
    setDraft('');
    await saveValue('');
  };

  if (!isEditing) {
    const showPlaceholder = !value || value.trim().length === 0;
    const canCollapse = !!multiline && !!collapsible && !!value && value.trim().length > showMoreThreshold;

    // Determine numberOfLines for display
    let displayLines: number | undefined;
    if (numberOfLines !== undefined) {
      // Use explicit numberOfLines prop if provided
      displayLines = numberOfLines;
    } else if (canCollapse && collapsed) {
      // Use collapsedLines for collapsible content
      displayLines = collapsedLines || 8;
    } else {
      // undefined = no limit
      displayLines = undefined;
    }

    return (
      <View>
        <TouchableOpacity onPress={beginEdit} activeOpacity={0.7} testID={testID}>
          <View style={styles.readonlyRow}>
            <Text
              style={[
                style,
                showPlaceholder && !placeholderTextColor && styles.placeholderText,
                showPlaceholder && placeholderTextColor && { color: placeholderTextColor, fontStyle: 'normal' },
                isDarkMode && (showPlaceholder && !placeholderTextColor ? styles.placeholderTextDark : null)
              ]}
              numberOfLines={displayLines}
              ellipsizeMode={ellipsizeMode}
            >
              {showPlaceholder ? placeholder : value}
            </Text>
            {!hideEditIcon && (
              <Feather name="edit" size={16} color={isDarkMode ? '#AAA' : '#555'} style={styles.pencilIcon} />
            )}
            {!hideEditIcon && justSaved && (
              <Text style={[styles.savedBadge, isDarkMode && styles.savedBadgeDark]}>✓ Saved</Text>
            )}
          </View>
        </TouchableOpacity>
        {canCollapse && (
          <TouchableOpacity onPress={() => setCollapsed(!collapsed)} activeOpacity={0.7}>
            <Text style={[styles.toggleText, isDarkMode && styles.toggleTextDark]}>
              {collapsed ? 'Show more ▼' : 'Show less ▲'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.editContainer}>
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={setDraft}
        onBlur={saveEdit}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor || (isDarkMode ? '#999' : '#888')}
        multiline={multiline}
        numberOfLines={multiline ? (maxLines || 6) : 1}
        style={[style, styles.input, isDarkMode && styles.inputDark]}
        returnKeyType={multiline ? 'default' : 'done'}
        onSubmitEditing={!multiline ? saveEdit : undefined}
        blurOnSubmit={!multiline}
      />
      {!hideEditIcon && (
        <View style={styles.controls}>
          <TouchableOpacity onPress={cancelEdit} style={styles.controlButton} activeOpacity={0.7}>
            <Text style={styles.controlText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAndSave} style={styles.controlButton} activeOpacity={0.7}>
            {isSaving ? (
              <ActivityIndicator size="small" />
            ) : (
              <MaterialIcons name="delete-outline" size={18} color="#FF3B30" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={saveEdit} style={styles.controlButton} activeOpacity={0.7}>
            {isSaving ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.controlText}>✓</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default InlineEditableText;

const styles = StyleSheet.create({
  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pencil: {
    marginLeft: 6,
    fontSize: 14,
    color: '#555',
  },
  pencilDark: {
    color: '#AAA',
  },
  pencilIcon: {
    marginLeft: 0,
  },
  savedBadge: {
    marginLeft: 8,
    fontSize: 12,
    color: '#228B22',
  },
  savedBadgeDark: {
    color: '#7CFC00',
  },
  editContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  inputDark: {
    borderColor: '#48484A',
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
  },
  placeholderText: {
    color: '#888',
    fontStyle: 'italic',
  },
  placeholderTextDark: {
    color: '#999',
  },
  controls: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  toggleText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 5,
    fontWeight: '500',
    textAlign: 'center',
    position: 'absolute',
    bottom: -17,
    right: 0,
    backgroundColor: 'white',
    width: '85',
    paddingLeft: 3,
    paddingRight: 3,
  },
  toggleTextDark: {
    color: '#5AC8FA',
    backgroundColor: '#1C1C1E',
  },
});


