import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Item } from '../../../types';
import { itemsActions } from '../../../stores/items';
import { openai } from '../../../services/openai';
import { buildItemContext } from '../../../services/contextBuilder';
import InlineEditableText from '../../InlineEditableText';

interface TldrSectionProps {
  item: Item;
  isDarkMode: boolean;
  onTldrChange?: (tldr: string) => void;
}

const TldrSection: React.FC<TldrSectionProps> = ({ item, isDarkMode, onTldrChange }) => {
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
        onTldrChange?.(generatedTldr);
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

  const handleSaveTldr = async (newTldr: string) => {
    setTldr(newTldr);
    await itemsActions.updateItemWithSync(item.id, { tldr: newTldr });
    onTldrChange?.(newTldr);
  };

  return (
    <View style={[styles.tldrContainer, isDarkMode && styles.tldrContainerDark]}>
      <Text style={[styles.tldrLabel, isDarkMode && styles.tldrLabelDark]}>
        TLDR
      </Text>
      {tldr ? (
        <View style={styles.tldrContent}>
          <InlineEditableText
            value={tldr}
            placeholder="AI-generated summary"
            onSave={handleSaveTldr}
            style={[styles.tldrText, isDarkMode && styles.tldrTextDark]}
            multiline
            maxLines={20}
            collapsible
            collapsedLines={6}
            showMoreThreshold={200}
            isDarkMode={isDarkMode}
            hideEditIcon={true}
          />
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
    backgroundColor: '#2C2C2E',
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
    right: 0,
    backgroundColor: 'white',
    maxWidth: 44,
  },
  tldrLabelDark: {
    color: '#FF8A8A',
  },
  tldrContent: {
    flex: 1,
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
