import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Item } from '../types';
import { itemsActions } from '../stores/items';
import { openai } from '../services/openai';
import { buildItemContext } from '../services/contextBuilder';
import InlineEditableText from './InlineEditableText';

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
    <View style={styles.tldrSection}>
      <Text style={[styles.tldrSectionLabel, isDarkMode && styles.tldrSectionLabelDark]}>
        TLDR
      </Text>
      {tldr ? (
        <InlineEditableText
          value={tldr}
          placeholder="AI-generated summary"
          onSave={handleSaveTldr}
          style={[styles.tldrText, isDarkMode && styles.tldrTextDark]}
          multiline
          maxLines={6}
          collapsible
          collapsedLines={4}
          showMoreThreshold={200}
          isDarkMode={isDarkMode}
        />
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
  tldrSection: {
    marginBottom: 20,
  },
  tldrSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#666',
    marginBottom: 8,
  },
  tldrSectionLabelDark: {
    color: '#999',
  },
  tldrText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  tldrTextDark: {
    color: '#CCC',
  },
  tldrGenerateButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tldrGenerateButtonDark: {
    backgroundColor: '#0A84FF',
  },
  tldrGenerateButtonDisabled: {
    backgroundColor: '#999',
  },
  tldrGenerateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TldrSection;
