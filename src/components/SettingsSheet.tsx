import React, { forwardRef, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { themeStore, themeActions } from '../stores/theme';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { router } from 'expo-router';
import { COLORS, UI, APP, STORAGE_KEYS } from '../constants';
import { syncService } from '../services/syncService';
import { itemsActions } from '../stores/items';
import { spacesActions } from '../stores/spaces';
import { itemSpacesActions } from '../stores/itemSpaces';
import { itemMetadataActions } from '../stores/itemMetadata';
import { itemTypeMetadataActions } from '../stores/itemTypeMetadata';
import { offlineQueueActions } from '../stores/offlineQueue';
import { syncStatusStore, syncStatusComputed } from '../stores/syncStatus';
import { aiSettingsStore, aiSettingsActions, aiSettingsComputed } from '../stores/aiSettings';
import { expandedItemUIStore, expandedItemUIActions } from '../stores/expandedItemUI';
import ModelPickerSheet from './ModelPickerSheet';
import { useState } from 'react';
import { ReactNativeLegal } from 'react-native-legal';
import UniversalButton from './UniversalButton';

interface SettingsSheetProps {
  // Additional props can be added here
}

const SettingsSheet = observer(
  forwardRef<BottomSheet, SettingsSheetProps>(({ onOpen, onClose }, ref) => {
    const { user, signOut } = useAuth();
    const isDarkMode = themeStore.isDarkMode.get();
    const { showToast } = useToast();
    const [modelPickerVisible, setModelPickerVisible] = useState(false);

    // Sync status observables
    const pendingChanges = syncStatusStore.pendingChanges.get();
    const isOnline = syncStatusStore.isOnline.get();
    const isSyncingStatus = syncStatusStore.isSyncing.get();
    const formattedLastSync = syncStatusComputed.formattedLastSync();
    const statusText = syncStatusComputed.statusText();
    const statusColor = syncStatusComputed.statusColor();

    // AI settings observables
    const selectedModel = aiSettingsStore.selectedModel.get();
    const metadataModel = aiSettingsStore.metadataModel.get();
    const availableModels = aiSettingsStore.availableModels.get();
    const hasApiKey = aiSettingsStore.hasApiKey.get();
    const isLoadingModels = aiSettingsStore.isLoadingModels.get();
    const timeSinceLastFetch = aiSettingsComputed.timeSinceLastFetch();
    const autoGenerateTranscripts = aiSettingsStore.autoGenerateTranscripts.get();
    const autoGenerateImageDescriptions = aiSettingsStore.autoGenerateImageDescriptions.get();
    const [modelPickerType, setModelPickerType] = useState<'chat' | 'metadata'>('chat');

    // Expanded item UI settings
    const autoplayXVideos = expandedItemUIStore.autoplayXVideos.get();

    // Snap points for the bottom sheet - single point at 82%
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

    const handleSignOut = async () => {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                await signOut();
                // Navigation is handled automatically by useAuth hook
              } catch (error) {
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              }
            },
          },
        ]
      );
    };

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
          }
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Settings
          </Text>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Appearance
            </Text>

            <View style={styles.row}>
              <MaterialIcons
                name="brightness-6"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Dark Mode
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={(value) => themeActions.setDarkMode(value)}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
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
                  Autoplay X Videos
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Automatically play video previews in the grid
                </Text>
              </View>
              <Switch
                value={autoplayXVideos}
                onValueChange={(value) => expandedItemUIActions.setAutoplayXVideos(value)}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={autoplayXVideos ? '#fff' : '#f4f3f4'}
              />
            </View>

          </View>

          {/* AI & Chat Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              AI & CHAT
            </Text>

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
                  {selectedModel}
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
                  {metadataModel} · Used for title/description extraction
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666' : '#999'}
              />
            </TouchableOpacity>

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

            <View style={styles.row}>
              <MaterialIcons
                name="refresh"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Refresh Models List
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  {availableModels.length > 0
                    ? `${availableModels.length} models • Last updated: ${timeSinceLastFetch}`
                    : 'No models loaded'}
                </Text>
                <View style={{ marginTop: 8 }}>
                  <UniversalButton
                    label="Refresh Models"
                    icon="refresh"
                    onPress={async () => {
                      if (!hasApiKey) {
                        throw new Error('API Key Required. Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.');
                      }
                      await aiSettingsActions.fetchModels(true);
                    }}
                    variant="secondary"
                    size="small"
                    showToastOnSuccess
                    successMessage={`Loaded ${availableModels.length} models`}
                    errorMessage="Failed to refresh models"
                    disabled={!hasApiKey || isLoadingModels}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Data & Sync Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Data & Sync
            </Text>
            
            <View style={styles.row}>
              <MaterialIcons
                name="cloud-queue"
                size={24}
                color={statusColor}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  {statusText}
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Last sync: {formattedLastSync}
                </Text>
              </View>
              {pendingChanges > 0 && (
                <View style={[styles.badge, { backgroundColor: statusColor }]}>
                  <Text style={styles.badgeText}>{pendingChanges}</Text>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <MaterialIcons
                name="sync"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Sync with Cloud
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Force sync all data with Supabase
                </Text>
                <View style={{ marginTop: 8 }}>
                  <UniversalButton
                    label="Sync Now"
                    icon="sync"
                    onPress={async () => {
                      console.log('🔄 Starting manual sync...');
                      const result = await syncService.forceSync();
                      if (!result.success) {
                        throw new Error(result.errors.join('\n'));
                      }
                    }}
                    variant="secondary"
                    size="small"
                    showToastOnSuccess
                    successMessage="Synced successfully"
                    errorMessage="Sync failed"
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.row}
              onPress={async () => {
                Alert.alert(
                  'Clean Orphaned Data',
                  'This will remove local metadata and relationships for items that no longer exist in the cloud. This is safe and helps fix sync issues.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clean',
                      onPress: async () => {
                        try {
                          const result = await syncService.cleanupOrphanedData();
                          if (result.cleaned > 0) {
                            Alert.alert(
                              'Cleanup Complete',
                              `Removed ${result.cleaned} orphaned records:\n\n${result.details.join('\n')}`
                            );
                          } else {
                            showToast({ message: 'Your local data is clean - no orphaned records found', type: 'info' });
                          }
                        } catch (error) {
                          Alert.alert('Error', 'Failed to clean orphaned data. Please try again.');
                        }
                      },
                    },
                  ]
                );
              }}
              disabled={isSyncing}
            >
              <MaterialIcons
                name="cleaning-services"
                size={24}
                color={isSyncing ? '#999' : (isDarkMode ? '#FFFFFF' : '#333333')}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark, isSyncing && styles.rowDisabled]}>
                  Clean Orphaned Data
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Fix sync issues by removing orphaned metadata
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
                if (isSyncing) return;
                Alert.alert(
                  'Clear Local Data',
                  'This will delete all locally stored items and spaces. Data in the cloud will remain. Are you sure?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          // Clear AsyncStorage first
                          await AsyncStorage.removeItem(STORAGE_KEYS.ITEMS);
                          await AsyncStorage.removeItem(STORAGE_KEYS.SPACES);
                          await AsyncStorage.removeItem(STORAGE_KEYS.ITEM_SPACES);
                          await AsyncStorage.removeItem(STORAGE_KEYS.ITEM_METADATA);
                          await AsyncStorage.removeItem(STORAGE_KEYS.ITEM_TYPE_METADATA);
                          await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);

                          // Then clear all stores in memory
                          itemsActions.clearAll();
                          spacesActions.clearAll();
                          itemSpacesActions.reset();
                          itemMetadataActions.reset();
                          itemTypeMetadataActions.reset();
                          offlineQueueActions.reset();

                          Alert.alert('Success', 'All local data has been cleared. You can sync from cloud to restore.');
                        } catch (error: any) {
                          console.error('Error clearing local data:', error);
                          Alert.alert('Error', `Failed to clear local data: ${error.message}`);
                        }
                      },
                    },
                  ]
                );
              }}
              disabled={isSyncing}
            >
              <MaterialIcons
                name="delete-sweep"
                size={24}
                color={isSyncing ? '#999' : '#FF3B30'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: isSyncing ? '#999' : '#FF3B30' }, isSyncing && styles.rowDisabled]}>
                  Clear All Local Data
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Remove all locally stored items and spaces
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666' : '#999'}
              />
            </TouchableOpacity>

          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              About
            </Text>

            <TouchableOpacity style={styles.row}>
              <MaterialIcons
                name="help"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Help & Support
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666' : '#999'}
              />
            </TouchableOpacity>

            <View style={styles.row}>
              <MaterialIcons
                name="info"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Version
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  {Constants.expoConfig?.version || 'Unknown'} ({Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || 'Unknown'})
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                try {
                  ReactNativeLegal.launchLicenseListScreen('Open Source Licenses');
                } catch (error) {
                  console.error('Error opening legal info:', error);
                  Alert.alert('Error', 'Unable to open legal information');
                }
              }}
            >
              <MaterialIcons
                name="gavel"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Legal & Licenses
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  View open source licenses
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666' : '#999'}
              />
            </TouchableOpacity>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Account
            </Text>

            <TouchableOpacity style={styles.row}>
              <MaterialIcons
                name="person"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Email
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  {user?.email || 'Not signed in'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={handleSignOut}>
              <MaterialIcons
                name="logout"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Sign Out
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDarkMode ? '#666' : '#999'}
              />
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Model Picker Modal */}
      <ModelPickerSheet
        visible={modelPickerVisible}
        onClose={() => setModelPickerVisible(false)}
        modelType={modelPickerType}
        onModelSelected={(modelId) => {
          console.log(`Selected ${modelPickerType} model:`, modelId);
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  syncingText: {
    fontSize: 16,
    color: '#999999',
  },
  syncingTextDark: {
    color: '#666666',
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SettingsSheet;