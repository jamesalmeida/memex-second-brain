import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated as RNAnimated } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import SectionHeader from './SectionHeader';

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs?: number;
}

interface TranscriptSectionProps {
  transcript: string;
  segments?: TranscriptSegment[];
  isDarkMode: boolean;
  isGenerating: boolean;
  onGenerate: () => Promise<void>;
  showToast?: (message: { message: string; type: 'success' | 'error' }) => void;
  enableTimestamps?: boolean; // YouTube-style features
  enableSrtExport?: boolean;  // YouTube-style features
}

const TranscriptSection: React.FC<TranscriptSectionProps> = ({
  transcript,
  segments = [],
  isDarkMode,
  isGenerating,
  onGenerate,
  showToast,
  enableTimestamps = false,
  enableSrtExport = false,
}) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);

  const transcriptOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(1);

  const transcriptExists = transcript && transcript.length > 0;

  useEffect(() => {
    if (transcriptExists) {
      buttonOpacity.value = withTiming(0, { duration: 150 }, () => {
        transcriptOpacity.value = withTiming(1, { duration: 150 });
      });
    } else {
      transcriptOpacity.value = 0;
      buttonOpacity.value = 1;
    }
  }, [transcriptExists]);

  const calculateStats = () => {
    const chars = transcript.length;
    const words = transcript.trim().split(/\s+/).length;
    const readTime = Math.ceil(words / 200);
    return { chars, words, readTime };
  };

  const stats = transcriptExists ? calculateStats() : null;

  const handleGenerate = async () => {
    try {
      await onGenerate();
      // Auto-expand after generation
      setTimeout(() => {
        setShowTranscript(true);
      }, 300);
    } catch (error) {
      console.error('Error generating transcript:', error);
      if (showToast) {
        showToast({ message: 'Failed to generate transcript', type: 'error' });
      }
    }
  };

  const copyTranscriptToClipboard = async () => {
    await Clipboard.setStringAsync(transcript);
    if (showToast) {
      showToast({ message: 'Transcript copied to clipboard', type: 'success' });
    }
  };

  const copySrtToClipboard = async () => {
    if (segments && segments.length > 0) {
      const srt = segments.map((s, idx) => {
        const toTimestamp = (ms: number) => {
          const total = Math.max(0, Math.floor(ms));
          const h = String(Math.floor(total / 3600000)).padStart(2, '0');
          const m = String(Math.floor((total % 3600000) / 60000)).padStart(2, '0');
          const sec = String(Math.floor((total % 60000) / 1000)).padStart(2, '0');
          const msRem = String(total % 1000).padStart(3, '0');
          return `${h}:${m}:${sec},${msRem}`;
        };
        const start = toTimestamp(s.startMs);
        const end = toTimestamp(s.endMs ?? (s.startMs + 2000));
        return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
      }).join('\n');
      await Clipboard.setStringAsync(srt);
      if (showToast) {
        showToast({ message: 'SRT copied to clipboard', type: 'success' });
      }
    } else {
      await copyTranscriptToClipboard();
    }
  };

  const formatTimestamp = (ms: number): string => {
    const mm = Math.floor(ms / 60000);
    const ss = Math.floor((ms % 60000) / 1000);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  return (
    <View style={styles.section}>
      <SectionHeader label="TRANSCRIPT" isDarkMode={isDarkMode} />

      {!transcriptExists ? (
        <RNAnimated.View style={{ opacity: buttonOpacity }}>
          <TouchableOpacity
            style={[
              styles.generateButton,
              isGenerating && styles.generateButtonDisabled,
              isDarkMode && styles.generateButtonDark,
            ]}
            onPress={handleGenerate}
            disabled={isGenerating}
            activeOpacity={0.7}
          >
            <Text style={styles.generateButtonText}>
              {isGenerating ? '⏳ Processing...' : '⚡ Generate'}
            </Text>
          </TouchableOpacity>
        </RNAnimated.View>
      ) : (
        <RNAnimated.View style={{ opacity: transcriptOpacity }}>
          <TouchableOpacity
            style={[styles.selector, isDarkMode && styles.selectorDark]}
            onPress={() => setShowTranscript(!showTranscript)}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectorText, isDarkMode && styles.selectorTextDark]}>
              {showTranscript ? 'Hide Transcript' : 'View Transcript'}
            </Text>
            <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>
              {showTranscript ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showTranscript && (
            <View style={[styles.content, isDarkMode && styles.contentDark]}>
              {(enableTimestamps || enableSrtExport) && (
                <View style={styles.topBar}>
                  {enableTimestamps && segments && segments.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setShowTimestamps(!showTimestamps)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.topBarText, isDarkMode && styles.topBarTextDark]}>
                        {showTimestamps ? 'Show Plain Text' : 'Show Timestamps'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.topBarRight}>
                    {enableSrtExport && (
                      <TouchableOpacity onPress={copySrtToClipboard} activeOpacity={0.7}>
                        <Text style={[styles.topBarText, { color: '#007AFF' }]}>
                          Copy SRT
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={copyTranscriptToClipboard}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.copyButtonText}>📋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {enableTimestamps && showTimestamps && segments && segments.length > 0 ? (
                  <View>
                    {segments.map((s, i) => (
                      <View key={`${s.startMs}-${i}`} style={styles.segmentItem}>
                        <Text style={[styles.transcriptText, isDarkMode && styles.transcriptTextDark]}>
                          [{formatTimestamp(s.startMs)}] {s.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.transcriptText, isDarkMode && styles.transcriptTextDark]}>
                    {segments && segments.length > 0 && !showTimestamps
                      ? segments.map(s => s.text).join(' ')
                      : transcript}
                  </Text>
                )}
              </ScrollView>

              {!enableTimestamps && !enableSrtExport && (
                <TouchableOpacity
                  style={styles.floatingCopyButton}
                  onPress={copyTranscriptToClipboard}
                  activeOpacity={0.7}
                >
                  <Text style={styles.copyButtonText}>📋</Text>
                </TouchableOpacity>
              )}

              {stats && (
                <View style={[styles.footer, isDarkMode && styles.footerDark]}>
                  <Text style={[styles.footerText, isDarkMode && styles.footerTextDark]}>
                    {stats.chars.toLocaleString()} chars • {stats.words.toLocaleString()} words • ~{stats.readTime} min read
                  </Text>
                </View>
              )}
            </View>
          )}
        </RNAnimated.View>
      )}
    </View>
  );
};

export default TranscriptSection;

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
    maxHeight: 400,
    position: 'relative',
  },
  contentDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#3A3A3C',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  topBarTextDark: {
    color: '#0A84FF',
  },
  scrollView: {
    marginBottom: 8,
  },
  segmentItem: {
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  transcriptTextDark: {
    color: '#FFFFFF',
  },
  copyButton: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCopyButton: {
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
  footer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  footerDark: {
    borderTopColor: '#3A3A3C',
  },
  footerText: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
  footerTextDark: {
    color: '#98989F',
  },
});
