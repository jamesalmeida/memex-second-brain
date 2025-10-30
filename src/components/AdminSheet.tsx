import React, { forwardRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { COLORS } from '../constants';
import { useToast } from '../contexts/ToastContext';
import { serpapi, SerpApiAccount, SerpApiError } from '../services/serpapi';
import { isAPIConfigured } from '../config/api';
import { adminPrefsStore, adminPrefsActions } from '../stores/adminPrefs';

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

    const fetchSerpApiStatus = useCallback(async () => {
      if (!isAPIConfigured.serpapi()) {
        setSerpError('API key not configured');
        setSerpAccount(null);
        setSerpLoading(false);
        return;
      }
      setSerpLoading(true);
      setSerpError(null);
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
    const snapPoints = useMemo(() => ['40%'], []);

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
          </View>

          {/* YouTube Enrichment Source */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>YouTube Enrichment Source</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Source</Text>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => adminPrefsActions.setYouTubeSource('youtubei')}
                  style={[styles.segBtn, adminPrefsStore.youtubeSource.get() === 'youtubei' && styles.segBtnActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.segBtnText, adminPrefsStore.youtubeSource.get() === 'youtubei' && styles.segBtnTextActive]}>youtubei.js</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => adminPrefsActions.setYouTubeSource('serpapi')}
                  style={[styles.segBtn, adminPrefsStore.youtubeSource.get() === 'serpapi' && styles.segBtnActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.segBtnText, adminPrefsStore.youtubeSource.get() === 'serpapi' && styles.segBtnTextActive]}>SerpAPI</Text>
                </TouchableOpacity>
              </View>
            </View>
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
                <View style={styles.rowBetween}>
                  <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Plan</Text>
                  <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.plan_name || '—'}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>This month</Text>
                  <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>
                    {serpAccount.this_month_usage ?? 0}/{serpAccount.this_month_limit ?? '∞'} used ({serpAccount.this_month_left ?? '∞'} left)
                  </Text>
                </View>
                {typeof serpAccount.hourly_search_limit !== 'undefined' && serpAccount.hourly_search_limit !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Hourly limit</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.hourly_search_limit}</Text>
                  </View>
                )}
                {typeof serpAccount.credits_left !== 'undefined' && serpAccount.credits_left !== null && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>Credits left</Text>
                    <Text style={[styles.valueText, isDarkMode && styles.valueTextDark]}>{serpAccount.credits_left}</Text>
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
  segBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 8,
  },
  segBtnActive: {
    backgroundColor: COLORS.primary,
  },
  segBtnText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  segBtnTextActive: {
    color: '#fff',
  },
});

export default AdminSheet;
