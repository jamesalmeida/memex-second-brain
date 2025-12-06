import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import ItemTagsSheet from './ItemTagsSheet';

export interface TagsEditorProps {
  tags: string[];
  onChangeTags: (tags: string[]) => void | Promise<void>;
  generateTags?: () => Promise<string[]>;
  buttonLabel?: string;
}

const TagsEditor = observer(({ tags, onChangeTags, generateTags, buttonLabel }: TagsEditorProps) => {
  const isDarkMode = themeStore.isDarkMode.get();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const overlayPulse = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const tagsSheetRef = useRef<BottomSheet & { openWithTags?: (tags: string[]) => void }>(null);

  const resolvedButtonLabel = useMemo(() => buttonLabel || '✨ Generate Tags', [buttonLabel]);

  useEffect(() => {
    if (isUpdating) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(overlayPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(overlayPulse, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      overlayPulse.setValue(0);
    }

    return () => {
      pulseLoopRef.current?.stop();
    };
  }, [isUpdating, overlayPulse]);

  const overlayOpacity = overlayPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  const handleOpenSheet = () => {
    if (tagsSheetRef.current?.openWithTags) {
      tagsSheetRef.current.openWithTags(tags);
    }
    tagsSheetRef.current?.snapToIndex(0);
  };

  const handleSheetDone = async (nextTags: string[]) => {
    setIsUpdating(true);
    try {
      await Promise.resolve(onChangeTags(nextTags));
    } finally {
      setIsUpdating(false);
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
      <View style={styles.tagsWrapper}>
        <View
          style={[styles.tagsContainer, isUpdating && styles.tagsContainerDisabled]}
          pointerEvents={isUpdating ? 'none' : 'auto'}
        >
          {tags.map((tag, index) => (
            <TouchableOpacity
              key={`${tag}-${index}`}
              style={[styles.tagChip, isDarkMode && styles.tagChipDark]}
              onPress={handleOpenSheet}
              activeOpacity={0.8}
            >
              <Text style={[styles.tagText, isDarkMode && styles.tagTextDark]}>{tag}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.addTagButton, isDarkMode && styles.addTagButtonDark]}
            onPress={handleOpenSheet}
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

        {isUpdating && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.updateOverlay,
              {
                opacity: overlayOpacity,
                backgroundColor: isDarkMode ? 'rgba(28,28,30,0.75)' : 'rgba(255,255,255,0.85)',
              },
            ]}
          >
            <View style={[styles.updateOverlayContent, isDarkMode && styles.updateOverlayContentDark]}>
              <ActivityIndicator size="small" color={isDarkMode ? '#F2F2F7' : '#333'} />
              <Text style={[styles.updateOverlayText, isDarkMode && styles.updateOverlayTextDark]}>
                Updating tags…
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

      <ItemTagsSheet
        ref={tagsSheetRef}
        onOpen={() => setIsSheetOpen(true)}
        onClose={() => setIsSheetOpen(false)}
        onDone={handleSheetDone}
      />
    </View>
  );
});

export default TagsEditor;

const styles = StyleSheet.create({
  tagsWrapper: {
    position: 'relative',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagsContainerDisabled: {
    opacity: 0.6,
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
  updateOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  updateOverlayContentDark: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  updateOverlayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  updateOverlayTextDark: {
    color: '#F2F2F7',
  },
});
