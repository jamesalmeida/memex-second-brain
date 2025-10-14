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
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await Promise.resolve(onSave(val));
      setIsEditing(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdit = async () => {
    await saveValue(draft);
  };

  const clearAndSave = async () => {
    setDraft('');
    await saveValue('');
  };

  if (!isEditing) {
    const showPlaceholder = !value || value.trim().length === 0;
    const canCollapse = !!multiline && !!collapsible && !!value && value.trim().length > showMoreThreshold;
    return (
      <View>
        <TouchableOpacity onPress={beginEdit} activeOpacity={0.7} testID={testID}>
          <View style={styles.readonlyRow}>
            <Text
              style={[style, showPlaceholder && styles.placeholderText, isDarkMode && (showPlaceholder ? styles.placeholderTextDark : null)]}
              numberOfLines={canCollapse && collapsed ? (collapsedLines || 6) : undefined}
            >
              {showPlaceholder ? placeholder : value}
            </Text>
            <Feather name="edit" size={16} color={isDarkMode ? '#AAA' : '#555'} style={styles.pencilIcon} />
            {justSaved && (
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
        multiline={multiline}
        numberOfLines={multiline ? (maxLines || 6) : 1}
        style={[style, styles.input, isDarkMode && styles.inputDark]}
        returnKeyType={multiline ? 'default' : 'done'}
        onSubmitEditing={!multiline ? saveEdit : undefined}
        blurOnSubmit={!multiline}
      />
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
    </View>
  );
};

export default InlineEditableText;

const styles = StyleSheet.create({
  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    marginLeft: 6,
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
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#3A3A3C',
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
    marginTop: 8,
    fontWeight: '500',
  },
  toggleTextDark: {
    color: '#5AC8FA',
  },
});


