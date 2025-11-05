import React, { forwardRef, useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { Host, Picker } from '@expo/ui/swift-ui';
import { themeStore } from '../stores/theme';
import { COLORS, API } from '../constants';
import { useToast } from '../contexts/ToastContext';
import { serpapi, SerpApiAccount, SerpApiError } from '../services/serpapi';
import { isAPIConfigured } from '../config/api';
import { adminSettingsStore, adminSettingsActions, adminSettingsComputed } from '../stores/adminSettings';
import ModelPickerSheet from './ModelPickerSheet';

interface AdminSheetProps {
  onOpen?: () => void;
  onClose?: () => void;
}

const AdminSheet = observer(
  forwardRef<BottomSheet, AdminSheetProps>(({ onOpen, onClose }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const { showToast, dismissToast } = useToast();
    const [showTestToast, setShowTestToast] = useState(false);
    const [currentToastId, setCurrentToastId] = useState<string | null>(null);

    // SerpAPI account status state
    const [serpLoading, setSerpLoading] = useState(false);
    const [serpError, setSerpError] = useState<string | null>(null);
    const [serpAccount, setSerpAccount] = useState<SerpApiAccount | null>(null);
    const [serpLastUpdated, setSerpLastUpdated] = useState<number | null>(null);

    // Model picker state
    const [modelPickerVisible, setModelPickerVisible] = useState(false);
    const [modelPickerType, setModelPickerType] = useState<'chat' | 'metadata'>('chat');
    const [isRefreshingModels, setIsRefreshingModels] = useState(false);

    // AI settings observables
    const selectedModel = adminSettingsComputed.aiChatModel();
    const metadataModel = adminSettingsComputed.aiMetadataModel();
    const availableModels = adminSettingsComputed.aiAvailableModels();
    const hasApiKey = !!API.OPENAI_API_KEY;
    const timeSinceLastFetch = adminSettingsComputed.timeSinceLastFetch();

    // YouTube source picker indices (computed from adminSettingsStore)
    const youtubeSourceIndex = (adminSettingsStore.settings.youtube_source.get() ?? 'youtubei') === 'youtubei' ? 0 : 1;
    const youtubeTranscriptSourceIndex = (adminSettingsStore.settings.youtube_transcript_source.get() ?? 'youtubei') === 'youtubei' ? 0 : 1;

    const fetchSerpApiStatus = useCallback(async () => {
      if (!isAPIConfigured.serpapi()) {
        setSerpError('API key not configured');
        setSerpAccount(null);
        setSerpLoading(false);
        return;
      }
      setSerpLoading(true);
      setSerpError(null);
      
      // Fetch account status (doesn't count against limit)
      const res = await serpapi.fetchAccount();
      if ((res as SerpApiError).error) {
        setSerpError((res as SerpApiError).error);
        setSerpAccount(null);
      } else {
        setSerpAccount(res as SerpApiAccount);
        setSerpLastUpdated(Date.now());
      }
      
      setSerpLoading(false);
    }, []);


    // Snap points for the bottom sheet
    const snapPoints = useMemo(() => ['82%'], []);

    // Render backdrop
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    return (
      <>
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        topInset={50}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
        onChange={(index) => {
          if (index === -1) {
            onClose?.();
          } else if (index >= 0) {
            onOpen?.();
            // Automatically refresh SerpAPI status when sheet opens
            if (isAPIConfigured.serpapi()) {
              fetchSerpApiStatus();
            }
          }
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Admin
          </Text>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* UI Debug Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              UI Debug
            </Text>

            <View style={styles.row}>
              <MaterialIcons
                name="notifications"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Show Test Toast
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Display a toast notification for styling
                </Text>
              </View>
              <Switch
                value={showTestToast}
                onValueChange={(value) => {
                  setShowTestToast(value);
                  if (value) {
                    // Show toast and save its ID
                    const toastId = showToast({
                      message: 'This is a test toast notification for styling purposes',
                      type: 'success',
                      duration: 999999999, // Very long duration (won't matter since we disabled auto-dismiss)
                    });
                    setCurrentToastId(toastId);
                  } else {
                    // Dismiss the toast when toggle is turned off
                    if (currentToastId) {
                      dismissToast(currentToastId);
                      setCurrentToastId(null);
                    }
                  }
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={showTestToast ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.row}>
              <MaterialIcons
                name="description"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Show Description Section
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Display description field in item views (for testing)
                </Text>
              </View>
              <Switch
                value={adminSettingsStore.settings.ui_show_description.get() ?? false}
                onValueChange={(value) => {
                  adminSettingsActions.setShowDescription(value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={adminSettingsStore.settings.ui_show_description.get() ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* AI Automation Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              AI Automation (Global)
            </Text>

            <View style={styles.row}>
              <MaterialIcons
                name="auto-awesome"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Auto-Generate TLDR
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Automatically generate TLDR when adding new items (applies to all users)
                </Text>
              </View>
              <Switch
                value={adminSettingsStore.settings.auto_generate_tldr.get() ?? false}
                onValueChange={(value) => {
                  adminSettingsActions.setAutoGenerateTldr(value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={adminSettingsStore.settings.auto_generate_tldr.get() ? '#fff' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.row}>
              <MaterialIcons
                name="subtitles"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Auto-generate Transcripts
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Automatically fetch video transcripts when saving items (applies to all users)
                </Text>
              </View>
              <Switch
                value={adminSettingsStore.settings.auto_generate_transcripts.get() ?? false}
                onValueChange={(value) => adminSettingsActions.setAutoGenerateTranscripts(value)}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={adminSettingsStore.settings.auto_generate_transcripts.get() ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.row}>
              <MaterialIcons
                name="image"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Auto-generate Image Descriptions
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Automatically describe images when saving items (applies to all users)
                </Text>
              </View>
              <Switch
                value={adminSettingsStore.settings.auto_generate_image_descriptions.get() ?? false}
                onValueChange={(value) => adminSettingsActions.setAutoGenerateImageDescriptions(value)}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={adminSettingsStore.settings.auto_generate_image_descriptions.get() ? '#fff' : '#f4f3f4'}
              />
            </View>

          {/* YouTube Enrichment Source */}
            <View style={styles.row}>
              <MaterialIcons
                name="video-library"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  YouTube Metadata Source
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Choose the API for fetching YouTube video metadata
                </Text>
                <View style={styles.pickerContainer}>
                  <Host matchContents>
                    <Picker
                      options={['youtubei.js', 'SerpAPI']}
                      selectedIndex={youtubeSourceIndex}
                      onOptionSelected={({ nativeEvent: { index } }) => {
                        adminSettingsActions.setYouTubeSource(index === 0 ? 'youtubei' : 'serpapi');
                      }}
                      variant="segmented"
                    />
                  </Host>
                </View>
              </View>
            </View>

            {/* YouTube Transcript Source */}
            <View style={styles.row}>
              <MaterialIcons
                name="closed-caption"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  YouTube Transcript Source
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Choose the API for fetching YouTube video transcripts
                </Text>
                <View style={styles.pickerContainer}>
                  <Host matchContents>
                    <Picker
                      options={['youtubei.js', 'SerpAPI']}
                      selectedIndex={youtubeTranscriptSourceIndex}
                      onOptionSelected={({ nativeEvent: { index } }) => {
                        adminSettingsActions.setYouTubeTranscriptSource(index === 0 ? 'youtubei' : 'serpapi');
                      }}
                      variant="segmented"
                    />
                  </Host>
                </View>
              </View>
            </View>

          </View>

          {/* AI & CHAT Section (Global) */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              AI & CHAT (Global)
            </Text>

            <View style={styles.row}>
              <MaterialIcons
                name="vpn-key"
                size={24}
                color={hasApiKey ? (isDarkMode ? '#FFFFFF' : '#333333') : '#FF9500'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  OpenAI API Key
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  {hasApiKey ? 'Configured ✅' : 'Not configured ⚠️'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                if (availableModels.length === 0 || !hasApiKey) {
                  Alert.alert(
                    'No Models Available',
                    hasApiKey
                      ? 'Please refresh the models list first.'
                      : 'OpenAI API key is not configured. Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.'
                  );
                  return;
                }

                // Open chat model picker
                setModelPickerType('chat');
                setModelPickerVisible(true);
              }}
            >
              <MaterialIcons
                name="chat"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Chat Model Selection
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  {selectedModel} · Used for all chat conversations (applies to all users)
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666' : '#999'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                if (availableModels.length === 0 || !hasApiKey) {
                  Alert.alert(
                    'No Models Available',
                    hasApiKey
                      ? 'Please refresh the models list first.'
                      : 'OpenAI API key is not configured. Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.'
                  );
                  return;
                }

                // Open metadata model picker
                setModelPickerType('metadata');
                setModelPickerVisible(true);
              }}
            >
              <MaterialIcons
                name="label"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Metadata Model Selection
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  {metadataModel} · Used for title/description extraction (applies to all users)
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666' : '#999'}
              />
            </TouchableOpacity>

            

            <TouchableOpacity
              style={styles.row}
              onPress={async () => {
                if (!hasApiKey) {
                  Alert.alert(
                    'API Key Required',
                    'Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env file to use AI features.'
                  );
                  return;
                }

                setIsRefreshingModels(true);
                try {
                  await adminSettingsActions.fetchModels(true);
                  showToast({ message: `Loaded ${availableModels.length} models`, type: 'success' });
                } catch (error: any) {
                  Alert.alert('Error', error.message || 'Failed to refresh models');
                } finally {
                  setIsRefreshingModels(false);
                }
              }}
              disabled={isRefreshingModels}
            >
              <MaterialIcons
                name="refresh"
                size={24}
                color={
                  isRefreshingModels
                    ? '#999'
                    : isDarkMode
                    ? '#FFFFFF'
                    : '#333333'
                }
              />
              <View style={styles.rowContent}>
                <Text
                  style={[
                    styles.rowTitle,
                    isDarkMode && styles.rowTitleDark,
                    isRefreshingModels && styles.rowDisabled,
                  ]}
                >
                  {isRefreshingModels ? 'Refreshing...' : 'Refresh Models List'}
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  {availableModels.length > 0
                    ? `${availableModels.length} models • Last updated: ${timeSinceLastFetch}`
                    : 'No models loaded'}
                </Text>
              </View>
              {isRefreshingModels ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={isDarkMode ? '#666' : '#999'}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* SerpAPI Status Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                SerpAPI Status
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={fetchSerpApiStatus}
                style={styles.iconButton}
              >
                <MaterialIcons
                  name="refresh"
                  size={20}
                  color={isDarkMode ? '#FFFFFF' : '#333333'}
                />
              </TouchableOpacity>
            </View>

            {!isAPIConfigured.serpapi() ? (
              <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>API key not configured</Text>
            ) : serpLoading ? (
              <View style={styles.row}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>Loading...</Text>
              </View>
            ) : serpError ? (
              <Text style={[styles.errorText, isDarkMode && styles.errorTextDark]}>{serpError}</Text>
            ) : serpAccount ? (
              <View>
                {serpAccount.account_id && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Account ID</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.account_id}</Text>
                  </View>
                )}
                {serpAccount.account_email && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Email</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.account_email}</Text>
                  </View>
                )}
                {serpAccount.plan_name && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Plan</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.plan_name}</Text>
                  </View>
                )}
                {typeof serpAccount.plan_monthly_price !== 'undefined' && serpAccount.plan_monthly_price !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Monthly Price</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>${serpAccount.plan_monthly_price.toFixed(2)}</Text>
                  </View>
                )}
                {typeof serpAccount.searches_per_month !== 'undefined' && serpAccount.searches_per_month !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Monthly Limit</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.searches_per_month.toLocaleString()}</Text>
                  </View>
                )}
                {typeof serpAccount.this_month_usage !== 'undefined' && serpAccount.this_month_usage !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>This Month Usage</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.this_month_usage.toLocaleString()}</Text>
                  </View>
                )}
                {typeof serpAccount.total_searches_left !== 'undefined' && serpAccount.total_searches_left !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Searches Left</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.total_searches_left.toLocaleString()}</Text>
                  </View>
                )}
                {typeof serpAccount.plan_searches_left !== 'undefined' && serpAccount.plan_searches_left !== null && serpAccount.plan_searches_left !== serpAccount.total_searches_left && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Plan Searches Left</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.plan_searches_left.toLocaleString()}</Text>
                  </View>
                )}
                {typeof serpAccount.extra_credits !== 'undefined' && serpAccount.extra_credits !== null && serpAccount.extra_credits > 0 && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Extra Credits</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.extra_credits.toLocaleString()}</Text>
                  </View>
                )}
                {typeof serpAccount.last_hour_searches !== 'undefined' && serpAccount.last_hour_searches !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Last Hour Searches</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.last_hour_searches}</Text>
                  </View>
                )}
                {typeof serpAccount.account_rate_limit_per_hour !== 'undefined' && serpAccount.account_rate_limit_per_hour !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Hourly Rate Limit</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.account_rate_limit_per_hour.toLocaleString()}</Text>
                  </View>
                )}
                {serpLastUpdated && (
                  <Text style={[styles.metaText, isDarkMode && styles.metaTextDark]}>Updated {new Date(serpLastUpdated).toLocaleTimeString()}</Text>
                )}
              </View>
            ) : (
              <TouchableOpacity onPress={fetchSerpApiStatus}>
                <Text style={[styles.linkText, isDarkMode && styles.linkTextDark]}>Tap to load SerpAPI status</Text>
              </TouchableOpacity>
            )}
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Model Picker Modal */}
      <ModelPickerSheet
        visible={modelPickerVisible}
        onClose={() => setModelPickerVisible(false)}
        modelType={modelPickerType}
        onModelSelected={async (modelId) => {
          console.log(`Selected ${modelPickerType} model:`, modelId);
          try {
            if (modelPickerType === 'chat') {
              await adminSettingsActions.setAiChatModel(modelId);
            } else {
              await adminSettingsActions.setAiMetadataModel(modelId);
            }
            showToast({
              message: `${modelPickerType === 'chat' ? 'Chat' : 'Metadata'} model updated successfully`,
              type: 'success'
            });
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update model');
          }
          setModelPickerVisible(false);
        }}
      />
      </>
    );
  })
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#CCCCCC',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#666666',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sectionTitleDark: {
    color: '#999999',
  },
  iconButton: {
    padding: 6,
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  rowContent: {
    flex: 1,
    marginLeft: 15,
  },
  rowTitle: {
    fontSize: 16,
    color: '#000000',
  },
  rowTitleDark: {
    color: '#FFFFFF',
  },
  rowSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  rowSubtitleDark: {
    color: '#666666',
  },
  rowDisabled: {
    opacity: 0.5,
  },
  valueText: {
    fontSize: 16,
    color: '#111111',
  },
  valueTextDark: {
    color: '#EAEAEA',
  },
  infoText: {
    fontSize: 14,
    color: '#555555',
    paddingVertical: 6,
  },
  infoTextDark: {
    color: '#AAAAAA',
  },
  errorText: {
    fontSize: 14,
    color: '#B00020',
    paddingVertical: 6,
  },
  errorTextDark: {
    color: '#FF6B6B',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#555555',
  },
  loadingTextDark: {
    color: '#AAAAAA',
  },
  metaText: {
    fontSize: 12,
    color: '#888888',
    marginTop: 8,
  },
  metaTextDark: {
    color: '#777777',
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    paddingVertical: 6,
  },
  linkTextDark: {
    color: COLORS.primary,
  },
  pickerContainer: {
    marginTop: 12,
  },
});

export default AdminSheet;
