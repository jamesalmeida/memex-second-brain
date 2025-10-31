import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import SectionHeader from './SectionHeader';
import ActionButton from './ActionButton';
import ExpandableContent from './ExpandableContent';

interface GenerateableContentSectionProps {
  label: string;
  content: string | null;
  isGenerating: boolean;
  isDarkMode: boolean;
  onGenerate: () => void;
  onCopy?: () => void;
  generateLabel?: string;
  generatingLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  showByDefault?: boolean;
  showStats?: boolean;
  buttonOpacity?: Animated.Value;
  contentOpacity?: Animated.Value;
}

const GenerateableContentSection: React.FC<GenerateableContentSectionProps> = ({
  label,
  content,
  isGenerating,
  isDarkMode,
  onGenerate,
  onCopy,
  generateLabel = '⚡ Generate',
  generatingLabel = '⏳ Processing...',
  expandLabel = 'View',
  collapseLabel = 'Hide',
  showByDefault = false,
  showStats = true,
  buttonOpacity,
  contentOpacity,
}) => {
  const contentExists = content && content.length > 0;

  return (
    <View style={styles.section}>
      <SectionHeader label={label} isDarkMode={isDarkMode} />

      {!contentExists ? (
        <Animated.View style={buttonOpacity ? { opacity: buttonOpacity } : undefined}>
          <ActionButton
            label={isGenerating ? generatingLabel : generateLabel}
            onPress={onGenerate}
            disabled={isGenerating}
            isDarkMode={isDarkMode}
            variant="primary"
          />
        </Animated.View>
      ) : (
        <Animated.View style={contentOpacity ? { opacity: contentOpacity } : undefined}>
          <ExpandableContent
            content={content}
            isDarkMode={isDarkMode}
            showByDefault={showByDefault}
            expandLabel={expandLabel}
            collapseLabel={collapseLabel}
            onCopy={onCopy}
            showStats={showStats}
          />
        </Animated.View>
      )}
    </View>
  );
};

export default GenerateableContentSection;

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
});
