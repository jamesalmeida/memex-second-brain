import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';

export interface TagsEditorProps {
  tags: string[];
  onChangeTags: (tags: string[]) => void | Promise<void>;
  generateTags?: () => Promise<string[]>;
  buttonLabel?: string;
}

const TagsEditor = observer(({ tags, onChangeTags, generateTags, buttonLabel }: TagsEditorProps) => {
  const isDarkMode = themeStore.isDarkMode.get();

  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const resolvedButtonLabel = useMemo(() => buttonLabel || '✨ Generate Tags', [buttonLabel]);

  const handleAddTag = async () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setTagInput('');
      setShowTagInput(false);
      return;
    }
    const next = [...tags, trimmed];
    await Promise.resolve(onChangeTags(next));
    setTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const next = tags.filter(t => t !== tagToRemove);
    await Promise.resolve(onChangeTags(next));
  };

  const handleGenerate = async () => {
    if (!generateTags) return;
    setIsGenerating(true);
    try {
      const newTags = await generateTags();
      if (Array.isArray(newTags) && newTags.length > 0) {
        const unique = Array.from(new Set([...tags, ...newTags]));
        await Promise.resolve(onChangeTags(unique));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View>
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => (
          <View key={`${tag}-${index}`} style={[styles.tagChip, isDarkMode && styles.tagChipDark]}>
            <Text style={[styles.tagText, isDarkMode && styles.tagTextDark]}>{tag}</Text>
            <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={styles.tagRemoveButton}>
              <Text style={[styles.tagRemoveText, isDarkMode && styles.tagRemoveTextDark]}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        {showTagInput ? (
          <View style={[styles.tagInputContainer, isDarkMode && styles.tagInputContainerDark]}>
            <TextInput
              style={[styles.tagInput, isDarkMode && styles.tagInputDark]}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              placeholder="Add tag..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              autoFocus
              onBlur={() => {
                if (!tagInput.trim()) setShowTagInput(false);
              }}
              returnKeyType="done"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addTagButton, isDarkMode && styles.addTagButtonDark]}
            onPress={() => setShowTagInput(true)}
          >
            <Text style={[styles.addTagButtonText, isDarkMode && styles.addTagButtonTextDark]}>+ Add Tag</Text>
          </TouchableOpacity>
        )}

        {generateTags && (
          <TouchableOpacity
            style={[styles.aiButton, isDarkMode && styles.aiButtonDark, isGenerating && styles.aiButtonDisabled]}
            onPress={handleGenerate}
            disabled={isGenerating}
          >
            <Text style={[styles.aiButtonText, isDarkMode && styles.aiButtonTextDark]}>
              {isGenerating ? 'Generating...' : resolvedButtonLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default TagsEditor;

const styles = StyleSheet.create({
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Tag chip styles (match AddItemSheet)
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipDark: {
    backgroundColor: '#2C2C2E',
  },
  tagText: {
    fontSize: 14,
    color: '#333',
  },
  tagTextDark: {
    color: '#FFF',
  },
  tagRemoveButton: {
    marginLeft: 6,
  },
  tagRemoveText: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
  },
  tagRemoveTextDark: {
    color: '#666',
  },
  // AI button (blue) matching AddItemSheet
  aiButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#007AFF',
  },
  aiButtonDark: {
    backgroundColor: '#0A84FF',
  },
  aiButtonDisabled: {
    opacity: 0.5,
  },
  aiButtonText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  aiButtonTextDark: {
    color: '#FFF',
  },
  // Add tag input and button
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    minWidth: 100,
  },
  tagInputContainerDark: {
    backgroundColor: '#2C2C2E',
  },
  tagInput: {
    fontSize: 14,
    color: '#333',
    padding: 0,
    minWidth: 80,
  },
  tagInputDark: {
    color: '#FFF',
  },
  addTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  addTagButtonDark: {
    borderColor: '#3C3C3E',
  },
  addTagButtonText: {
    fontSize: 14,
    color: '#666',
  },
  addTagButtonTextDark: {
    color: '#999',
  },
});


