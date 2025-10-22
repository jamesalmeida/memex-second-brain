import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import TagsManagerModal from './TagsManagerModal';

export interface TagsEditorProps {
  tags: string[];
  onChangeTags: (tags: string[]) => void | Promise<void>;
  generateTags?: () => Promise<string[]>;
  buttonLabel?: string;
}

const TagsEditor = observer(({ tags, onChangeTags, generateTags, buttonLabel }: TagsEditorProps) => {
  const isDarkMode = themeStore.isDarkMode.get();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedButtonLabel = useMemo(() => buttonLabel || '✨ Generate Tags', [buttonLabel]);

  const handleOpenModal = () => {
    setIsModalVisible(true);
  };

  const handleModalCancel = () => {
    if (isSubmitting) return;
    setIsModalVisible(false);
  };

  const handleModalDone = async (nextTags: string[]) => {
    setIsSubmitting(true);
    try {
      await Promise.resolve(onChangeTags(nextTags));
      setIsModalVisible(false);
    } finally {
      setIsSubmitting(false);
    }
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
          <TouchableOpacity
            key={`${tag}-${index}`}
            style={[styles.tagChip, isDarkMode && styles.tagChipDark]}
            onPress={handleOpenModal}
            activeOpacity={0.8}
          >
            <Text style={[styles.tagText, isDarkMode && styles.tagTextDark]}>{tag}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.addTagButton, isDarkMode && styles.addTagButtonDark]}
          onPress={handleOpenModal}
        >
          <Text style={[styles.addTagButtonText, isDarkMode && styles.addTagButtonTextDark]}>
            + {tags.length > 0 ? 'Manage Tags' : 'Add Tag'}
          </Text>
        </TouchableOpacity>

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

      <TagsManagerModal
        visible={isModalVisible}
        initialTags={tags}
        onCancel={handleModalCancel}
        onDone={handleModalDone}
        isSubmitting={isSubmitting}
      />
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
