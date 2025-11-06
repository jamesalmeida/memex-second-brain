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
import { openai, OpenAIAccountStatus, OpenAICostsData, OpenAIError } from '../services/openai';
import { isAPIConfigured } from '../config/api';
import { adminSettingsStore, adminSettingsActions, adminSettingsComputed } from '../stores/adminSettings';
import { consoleLogSettingsStore, consoleLogSettingsActions, consoleLogSettingsComputed } from '../stores/consoleLogSettings';
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

    // OpenAI account status state
    const [openaiLoading, setOpenaiLoading] = useState(false);
    const [openaiError, setOpenaiError] = useState<string | null>(null);
    const [openaiStatus, setOpenaiStatus] = useState<OpenAIAccountStatus | null>(null);
    const [openaiCosts, setOpenaiCosts] = useState<OpenAICostsData | null>(null);
    const [openaiLastUpdated, setOpenaiLastUpdated] = useState<number | null>(null);

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

    const fetchOpenAIStatus = useCallback(async () => {
      if (!hasApiKey) {
        setOpenaiError('API key not configured');
        setOpenaiStatus(null);
        setOpenaiCosts(null);
        setOpenaiLoading(false);
        return;
      }
      setOpenaiLoading(true);
      setOpenaiError(null);

      try {
        // Fetch account status and rate limits
        const status = await openai.fetchAccountStatus();
        setOpenaiStatus(status);

        if (!status.isValid) {
          setOpenaiError(status.error || 'Failed to validate API key');
          setOpenaiCosts(null);
        } else {
          // Fetch costs data for last 7 days
          const costs = await openai.fetchCosts();
          if ((costs as OpenAIError).error) {
            // Costs endpoint might not be available for all account types
            console.warn('Could not fetch OpenAI costs:', (costs as OpenAIError).error);
            setOpenaiCosts(null);
          } else {
            setOpenaiCosts(costs as OpenAICostsData);
          }
          setOpenaiLastUpdated(Date.now());
        }
      } catch (error: any) {
        setOpenaiError(error.message || 'Failed to fetch OpenAI status');
        setOpenaiStatus(null);
        setOpenaiCosts(null);
      }

      setOpenaiLoading(false);
    }, [hasApiKey]);


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
            // Automatically refresh API statuses when sheet opens
            if (isAPIConfigured.serpapi()) {
              fetchSerpApiStatus();
            }
            if (hasApiKey) {
              fetchOpenAIStatus();
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
          {/* Console Logs Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Console Logs
            </Text>

            {/* Master Toggle */}
            <View style={styles.row}>
              <MaterialIcons
                name="code"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Enable All Console Logs
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Master toggle - disables all console logs when off
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.enabled.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setEnabled(value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.enabled.get() ? '#fff' : '#f4f3f4'}
              />
            </View>

            {/* Sync & Offline Queue */}
            <View style={styles.row}>
              <MaterialIcons
                name="sync"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Sync & Offline Queue
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for sync operations, offline queue, and data synchronization
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.sync.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('sync', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.sync.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Chat & Messaging */}
            <View style={styles.row}>
              <MaterialIcons
                name="chat-bubble"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Chat & Messaging
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for sending/receiving chats, chat sheet operations
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.chat.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('chat', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.chat.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Authentication */}
            <View style={styles.row}>
              <MaterialIcons
                name="lock"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Authentication & Login
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for login, logout, session management, and keychain operations
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.auth.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('auth', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.auth.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Transcripts */}
            <View style={styles.row}>
              <MaterialIcons
                name="subtitles"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Transcript Generation
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for generating video transcripts from YouTube, X, etc.
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.transcripts.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('transcripts', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.transcripts.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Drawer & Bottom Sheets */}
            <View style={styles.row}>
              <MaterialIcons
                name="layers"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Drawer & Bottom Sheets
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for drawer opening/closing and bottom sheet lifecycle
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.drawer.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('drawer', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.drawer.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Items */}
            <View style={styles.row}>
              <MaterialIcons
                name="bookmark"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Item Saving & Creation
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for saving new items, updates, and deletions
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.items.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('items', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.items.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Enrichment Pipeline */}
            <View style={styles.row}>
              <MaterialIcons
                name="auto-fix-high"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Enrichment Pipeline
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for content type detection and metadata enrichment steps
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.enrichment.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('enrichment', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.enrichment.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* External APIs */}
            <View style={styles.row}>
              <MaterialIcons
                name="api"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  External API Integration
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for YouTube, X/Twitter, Instagram, Reddit, OpenAI API calls
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.api.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('api', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.api.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Metadata */}
            <View style={styles.row}>
              <MaterialIcons
                name="info"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Data Metadata & Storage
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for metadata operations and storage management
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.metadata.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('metadata', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.metadata.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Navigation */}
            <View style={styles.row}>
              <MaterialIcons
                name="navigation"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  UI/Navigation & Drawer Context
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for navigation state and drawer context handlers
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.navigation.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('navigation', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.navigation.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Admin Settings */}
            <View style={styles.row}>
              <MaterialIcons
                name="settings"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Admin Settings & Configuration
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for admin panel operations and model selection
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.admin.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('admin', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.admin.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>

            {/* Images */}
            <View style={styles.row}>
              <MaterialIcons
                name="image"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Image Operations & Uploads
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Logs for image description generation and upload operations
                </Text>
              </View>
              <Switch
                value={consoleLogSettingsStore.categories.images.get() ?? true}
                onValueChange={(value) => {
                  consoleLogSettingsActions.setCategoryEnabled('images', value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={consoleLogSettingsStore.categories.images.get() ? '#fff' : '#f4f3f4'}
                disabled={!consoleLogSettingsStore.enabled.get()}
              />
            </View>
          </View>

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

            <View style={styles.row}>
              <MaterialIcons
                name="play-circle-outline"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Youtube: Swap Embed for Thumbnails
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Show thumbnail + play button instead of embed (opens in YouTube app)
                </Text>
              </View>
              <Switch
                value={adminSettingsStore.settings.youtube_use_thumbnail.get() ?? false}
                onValueChange={(value) => {
                  adminSettingsActions.setYoutubeUseThumbnail(value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={adminSettingsStore.settings.youtube_use_thumbnail.get() ? '#fff' : '#f4f3f4'}
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

          {/* OpenAI Status Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                OpenAI Account Status
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={fetchOpenAIStatus}
                style={styles.iconButton}
                disabled={!hasApiKey}
              >
                <MaterialIcons
                  name="refresh"
                  size={20}
                  color={!hasApiKey ? '#999' : isDarkMode ? '#FFFFFF' : '#333333'}
                />
              </TouchableOpacity>
            </View>

            {!hasApiKey ? (
              <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>API key not configured</Text>
            ) : openaiLoading ? (
              <View style={styles.row}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>Loading...</Text>
              </View>
            ) : openaiError ? (
              <Text style={[styles.errorText, isDarkMode && styles.errorTextDark]}>{openaiError}</Text>
            ) : openaiStatus ? (
              <View>
                {/* API Key Status */}
                <View style={styles.rowBetween}>
                  <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>API Key</Text>
                  <Text style={[styles.valueText, isDarkMode && styles.valueTextDark, openaiStatus.isValid && styles.successText]}>
                    {openaiStatus.isValid ? 'Valid ✅' : 'Invalid ❌'}
                  </Text>
                </View>

                {/* Organization ID */}
                {openaiStatus.organizationId && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Organization ID</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{openaiStatus.organizationId}</Text>
                  </View>
                )}

                {/* Available Models */}
                {openaiStatus.availableModelsCount !== undefined && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Available Models</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{openaiStatus.availableModelsCount}</Text>
                  </View>
                )}

                {/* Rate Limits */}
                {openaiStatus.rateLimits && (
                  <>
                    {openaiStatus.rateLimits.requestsLimit !== undefined && (
                      <View style={styles.rowBetween}>
                        <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Requests Limit (per min)</Text>
                        <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>
                          {openaiStatus.rateLimits.requestsRemaining !== undefined
                            ? `${openaiStatus.rateLimits.requestsRemaining.toLocaleString()} / ${openaiStatus.rateLimits.requestsLimit.toLocaleString()}`
                            : openaiStatus.rateLimits.requestsLimit.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {openaiStatus.rateLimits.tokensLimit !== undefined && (
                      <View style={styles.rowBetween}>
                        <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Tokens Limit (per min)</Text>
                        <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>
                          {openaiStatus.rateLimits.tokensRemaining !== undefined
                            ? `${openaiStatus.rateLimits.tokensRemaining.toLocaleString()} / ${openaiStatus.rateLimits.tokensLimit.toLocaleString()}`
                            : openaiStatus.rateLimits.tokensLimit.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {/* Costs Summary */}
                {openaiCosts && openaiCosts.data && openaiCosts.data.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <Text style={[styles.subsectionTitle, isDarkMode && styles.subsectionTitleDark]}>
                      Last 7 Days Costs
                    </Text>
                    {openaiCosts.data.slice().reverse().map((day, index) => {
                      const totalCost = day.line_items.reduce((sum, item) => sum + item.cost, 0);
                      const date = new Date(day.timestamp * 1000);
                      return (
                        <View key={index} style={styles.rowBetween}>
                          <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                            {date.toLocaleDateString()}
                          </Text>
                          <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>
                            ${totalCost.toFixed(4)}
                          </Text>
                        </View>
                      );
                    })}
                    {openaiCosts.data.length > 0 && (
                      <View style={styles.rowBetween}>
                        <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark, styles.boldText]}>Total (7 days)</Text>
                        <Text style={[styles.valueText, isDarkMode && styles.valueTextDark, styles.boldText]}>
                          ${openaiCosts.data.reduce((sum, day) =>
                            sum + day.line_items.reduce((daySum, item) => daySum + item.cost, 0), 0
                          ).toFixed(4)}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {openaiLastUpdated && (
                  <Text style={[styles.metaText, isDarkMode && styles.metaTextDark]}>
                    Updated {new Date(openaiLastUpdated).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            ) : (
              <TouchableOpacity onPress={fetchOpenAIStatus}>
                <Text style={[styles.linkText, isDarkMode && styles.linkTextDark]}>Tap to load OpenAI status</Text>
              </TouchableOpacity>
            )}
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E7',
    marginVertical: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  subsectionTitleDark: {
    color: '#999999',
  },
  boldText: {
    fontWeight: '600',
  },
  successText: {
    color: '#34C759',
  },
});

export default AdminSheet;
