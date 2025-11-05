import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Item } from '../../../types';
import { itemsActions } from '../../../stores/items';
import { openai } from '../../../services/openai';
import { buildItemContext } from '../../../services/contextBuilder';

interface TldrSectionProps {
  item: Item;
  isDarkMode: boolean;
}

const TldrSection: React.FC<TldrSectionProps> = ({ item, isDarkMode }) => {
  const [tldr, setTldr] = useState<string>(item.tldr || '');
  const [isGeneratingTldr, setIsGeneratingTldr] = useState(false);

  const generateTldr = async () => {
    if (!item) return;

    setIsGeneratingTldr(true);
    try {
      // Build full context including transcript, images, metadata, etc.
      const contextResult = buildItemContext(item);

      console.log('🤖 Generating TLDR with context:', {
        wordCount: contextResult.metadata.wordCount,
        tokens: contextResult.metadata.estimatedTokens,
        hasTranscript: contextResult.metadata.hasTranscript,
        hasImageDescriptions: contextResult.metadata.hasImageDescriptions,
      });

      // Generate summary using full context
      const generatedTldr = await openai.summarizeContent(
        contextResult.contextString,
        contextResult.metadata.contentType
      );

      if (generatedTldr && generatedTldr !== 'Summary not available') {
        setTldr(generatedTldr);
        // Save to database
        await itemsActions.updateItemWithSync(item.id, { tldr: generatedTldr });
        console.log('TLDR generated and saved successfully');
      } else {
        alert('Failed to generate TLDR. Please try again.');
      }
    } catch (error) {
      console.error('Error generating TLDR:', error);
      alert('Failed to generate TLDR. Make sure OpenAI API is configured.');
    } finally {
      setIsGeneratingTldr(false);
    }
  };

  return (
    <View style={[styles.tldrContainer, isDarkMode && styles.tldrContainerDark]}>
      <Text style={[styles.tldrLabel, isDarkMode && styles.tldrLabelDark]}>
        TLDR
      </Text>
      {tldr ? (
        <View style={styles.tldrContent}>
          <Text style={[styles.tldrText, isDarkMode && styles.tldrTextDark]} numberOfLines={0}>
            {tldr}
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={generateTldr}
            disabled={isGeneratingTldr}
            activeOpacity={0.7}
          >
            {isGeneratingTldr ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#E5E5E7' : '#333'} />
            ) : (
              <Feather name="refresh-cw" size={18} color={isDarkMode ? '#E5E5E7' : '#555'} />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.tldrGenerateButton,
            isGeneratingTldr && styles.tldrGenerateButtonDisabled,
            isDarkMode && styles.tldrGenerateButtonDark
          ]}
          onPress={generateTldr}
          disabled={isGeneratingTldr}
          activeOpacity={0.7}
        >
          <Text style={styles.tldrGenerateButtonText}>
            {isGeneratingTldr ? '⏳ Generating...' : '⚡ Generate TLDR'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tldrContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  tldrContainerDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#48484A',
  },
  tldrLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#FF6B6B',
    marginBottom: 0,
    paddingLeft: 3,
    paddingRight: 3,
    position: 'absolute',
    top: -9,
    left: 15,
    backgroundColor: 'white',
    maxWidth: 44,
  },
  tldrLabelDark: {
    color: '#FF8A8A',
    backgroundColor: '#1C1C1E',
  },
  refreshButton: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    padding: 4,
    zIndex: 10,
  },
  tldrContent: {
    flex: 1,
    position: 'relative',
  },
  tldrText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
  },
  tldrTextDark: {
    color: '#E5E5E7',
  },
  tldrGenerateButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  tldrGenerateButtonDark: {
    backgroundColor: '#0A84FF',
  },
  tldrGenerateButtonDisabled: {
    backgroundColor: '#999',
  },
  tldrGenerateButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default TldrSection;
