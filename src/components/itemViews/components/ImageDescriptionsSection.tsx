import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated as RNAnimated } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { imageDescriptionsComputed } from '../../../stores/imageDescriptions';
import { ImageDescription } from '../../../types';
import SectionHeader from './SectionHeader';

interface ImageDescriptionsSectionProps {
  itemId: string;
  isDarkMode: boolean;
  onGenerate: () => Promise<void>;
  showToast?: (message: { message: string; type: 'success' | 'error' }) => void;
}

const ImageDescriptionsSection: React.FC<ImageDescriptionsSectionProps> = ({
  itemId,
  isDarkMode,
  onGenerate,
  showToast,
}) => {
  const [descriptions, setDescriptions] = useState<ImageDescription[]>([]);
  const [descriptionsExist, setDescriptionsExist] = useState(false);
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const descriptionsOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(1);

  // Load descriptions when component mounts or itemId changes
  useEffect(() => {
    if (!itemId) return;

    const loadDescriptions = () => {
      const descs = imageDescriptionsComputed.getDescriptionsByItemId(itemId);
      setDescriptions(descs);
      const exists = descs.length > 0;
      setDescriptionsExist(exists);

      if (exists) {
        // Animate in the descriptions
        buttonOpacity.value = withTiming(0, { duration: 150 }, () => {
          descriptionsOpacity.value = withTiming(1, { duration: 150 });
        });
      } else {
        // Show the button
        descriptionsOpacity.value = 0;
        buttonOpacity.value = 1;
      }
    };

    loadDescriptions();
  }, [itemId, imageDescriptionsComputed.descriptions()]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate();

      // Auto-expand dropdown after generation
      setTimeout(() => {
        setShowDescriptions(true);
      }, 300);
    } catch (error) {
      console.error('Error generating image descriptions:', error);
      if (showToast) {
        showToast({ message: 'Failed to generate image descriptions', type: 'error' });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (descriptions.length > 0) {
      const text = descriptions.map((desc, idx) =>
        `Image ${idx + 1}:\n${desc.description}`
      ).join('\n\n');
      await Clipboard.setStringAsync(text);
      if (showToast) {
        showToast({ message: 'Image descriptions copied to clipboard', type: 'success' });
      }
    }
  };

  const storeIsGenerating = imageDescriptionsComputed.isGenerating(itemId);

  return (
    <View style={styles.section}>
      <SectionHeader label="IMAGE DESCRIPTIONS" isDarkMode={isDarkMode} />

      {!descriptionsExist ? (
        <RNAnimated.View style={{ opacity: buttonOpacity }}>
          <TouchableOpacity
            style={[
              styles.generateButton,
              (isGenerating || storeIsGenerating) && styles.generateButtonDisabled,
              isDarkMode && styles.generateButtonDark,
            ]}
            onPress={handleGenerate}
            disabled={isGenerating || storeIsGenerating}
            activeOpacity={0.7}
          >
            <Text style={styles.generateButtonText}>
              {(isGenerating || storeIsGenerating) ? '⏳ Processing...' : '⚡ Generate'}
            </Text>
          </TouchableOpacity>
        </RNAnimated.View>
      ) : (
        <RNAnimated.View style={{ opacity: descriptionsOpacity }}>
          <TouchableOpacity
            style={[styles.selector, isDarkMode && styles.selectorDark]}
            onPress={() => setShowDescriptions(!showDescriptions)}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectorText, isDarkMode && styles.selectorTextDark]}>
              {showDescriptions ? 'Hide Descriptions' : `View Descriptions (${descriptions.length})`}
            </Text>
            <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>
              {showDescriptions ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showDescriptions && (
            <View style={[styles.content, isDarkMode && styles.contentDark]}>
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {descriptions.map((desc, idx) => (
                  <View key={desc.id} style={styles.descriptionItem}>
                    <Text style={[styles.descriptionLabel, isDarkMode && styles.descriptionLabelDark]}>
                      Image {idx + 1}:
                    </Text>
                    <Text style={[styles.descriptionText, isDarkMode && styles.descriptionTextDark]}>
                      {desc.description}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyToClipboard}
                activeOpacity={0.7}
              >
                <Text style={styles.copyButtonText}>📋</Text>
              </TouchableOpacity>
            </View>
          )}
        </RNAnimated.View>
      )}
    </View>
  );
};

export default ImageDescriptionsSection;

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  generateButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  generateButtonDark: {
    backgroundColor: '#0A84FF',
  },
  generateButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  selectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  selectorTextDark: {
    color: '#0A84FF',
  },
  chevron: {
    fontSize: 12,
    color: '#007AFF',
  },
  chevronDark: {
    color: '#0A84FF',
  },
  content: {
    marginTop: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    maxHeight: 300,
    position: 'relative',
  },
  contentDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#3A3A3C',
  },
  scrollView: {
    marginBottom: 8,
  },
  descriptionItem: {
    marginBottom: 12,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  descriptionLabelDark: {
    color: '#98989F',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  descriptionTextDark: {
    color: '#FFFFFF',
  },
  copyButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    fontSize: 16,
  },
});
