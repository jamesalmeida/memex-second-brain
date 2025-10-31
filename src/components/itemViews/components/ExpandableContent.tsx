import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface ExpandableContentProps {
  content: string;
  isDarkMode: boolean;
  showByDefault?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  onCopy?: () => void;
  showCopyButton?: boolean;
  showStats?: boolean;
  maxHeight?: number;
}

const ExpandableContent: React.FC<ExpandableContentProps> = ({
  content,
  isDarkMode,
  showByDefault = false,
  expandLabel = 'View',
  collapseLabel = 'Hide',
  onCopy,
  showCopyButton = true,
  showStats = true,
  maxHeight = 300,
}) => {
  const [isExpanded, setIsExpanded] = useState(showByDefault);

  const calculateStats = () => {
    const chars = content.length;
    const words = content.trim().split(/\s+/).length;
    const readingTime = Math.ceil(words / 200); // Average reading speed: 200 words/min
    return { chars, words, readingTime };
  };

  const stats = showStats ? calculateStats() : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.toggleButton, isDarkMode && styles.toggleButtonDark]}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <Text style={[styles.toggleText, isDarkMode && styles.toggleTextDark]}>
          {isExpanded ? collapseLabel : expandLabel}
        </Text>
        <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>
          {isExpanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={[styles.contentWrapper, isDarkMode && styles.contentWrapperDark]}>
          <ScrollView
            style={[styles.scrollView, { maxHeight }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.contentText, isDarkMode && styles.contentTextDark]}>
              {content}
            </Text>
          </ScrollView>

          {showCopyButton && onCopy && (
            <TouchableOpacity style={styles.copyButton} onPress={onCopy}>
              <Text style={styles.copyButtonText}>📋</Text>
            </TouchableOpacity>
          )}

          {stats && (
            <View style={[styles.statsFooter, isDarkMode && styles.statsFooterDark]}>
              <Text style={[styles.statsText, isDarkMode && styles.statsTextDark]}>
                {stats.chars.toLocaleString()} characters • {stats.words.toLocaleString()} words • ~{stats.readingTime} min read
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default ExpandableContent;

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  toggleButton: {
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
  toggleButtonDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  toggleTextDark: {
    color: '#0A84FF',
  },
  chevron: {
    fontSize: 12,
    color: '#007AFF',
  },
  chevronDark: {
    color: '#0A84FF',
  },
  contentWrapper: {
    marginTop: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    position: 'relative',
  },
  contentWrapperDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#3A3A3C',
  },
  scrollView: {
    marginBottom: 8,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  contentTextDark: {
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
  statsFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  statsFooterDark: {
    borderTopColor: '#3A3A3C',
  },
  statsText: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
  statsTextDark: {
    color: '#98989F',
  },
});
