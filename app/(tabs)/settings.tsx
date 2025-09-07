import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '../../src/hooks/useAuth';
import { themeStore, themeActions } from '../../src/stores/theme';
import { authActions } from '../../src/stores/auth';
import { syncStatusStore, syncStatusComputed, syncStatusActions } from '../../src/stores/syncStatus';
import { syncService } from '../../src/services/syncService';
import { itemsActions } from '../../src/stores/items';
import { supabase } from '../../src/services/supabase';
import { COLORS, UI, APP } from '../../src/constants';
import { SettingsSection } from '../../src/components/SettingsSection';
import { SettingsItem } from '../../src/components/SettingsItem';

const SettingsScreen = observer(() => {
  const { user, signOut } = useAuth();
  const isDarkMode = themeStore.isDarkMode.get();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Sync status
  const syncStatusText = syncStatusComputed.statusText();
  const syncStatusColor = syncStatusComputed.statusColor();
  const isSyncing = syncStatusStore.isSyncing.get();
  const pendingChanges = syncStatusStore.pendingChanges.get();
  const isOnline = syncStatusStore.isOnline.get();
  
  // Debug logging
  console.log('🔧 Settings Screen - isDarkMode from store:', isDarkMode);

  const containerStyle = [
    styles.container,
    isDarkMode && styles.containerDark,
  ];

  const titleStyle = [
    styles.title,
    isDarkMode && styles.titleDark,
  ];

  const handleLogout = () => {
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
              router.replace('/auth');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Password changed successfully');
        setShowChangePassword(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // In a real app, you'd call an API to delete the account
            Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear locally cached data. You can re-sync from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          onPress: () => {
            // TODO: Implement cache clearing
            Alert.alert('Success', 'Cache cleared successfully');
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert('Feature Coming Soon', 'Data export functionality will be available in a future update.');
  };

  const handleForceSync = async () => {
    if (isSyncing || !isOnline) {
      Alert.alert('Cannot Sync', 'Already syncing or offline');
      return;
    }
    
    try {
      const result = await syncService.forceSync();
      if (result.success) {
        Alert.alert('Success', `Synced ${result.itemsSynced} items successfully`);
      } else {
        Alert.alert('Sync Failed', result.errors.join('\n'));
      }
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Failed to sync. Please try again later.');
    }
  };

  return (
    <View style={containerStyle}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={titleStyle}>Settings</Text>
          <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
            Manage your account and app preferences
          </Text>
        </View>

        {/* Account Section */}
        <SettingsSection title="Account" isDarkMode={isDarkMode}>
          <SettingsItem
            title="Email"
            subtitle={user?.email || 'Not signed in'}
            isDarkMode={isDarkMode}
            showArrow={false}
          />

          <SettingsItem
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => setShowChangePassword(true)}
            isDarkMode={isDarkMode}
          />

          <SettingsItem
            title="Sign Out"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            isDarkMode={isDarkMode}
          />

          <SettingsItem
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={handleDeleteAccount}
            isDarkMode={isDarkMode}
          />
        </SettingsSection>

        {/* Sync Status Section */}
        <SettingsSection title="Sync Status" isDarkMode={isDarkMode}>
          <SettingsItem
            title="Status"
            subtitle={syncStatusText}
            rightComponent={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: syncStatusColor,
                    marginRight: 8,
                  }}
                />
                <Text style={[{ color: '#666' }, isDarkMode && { color: '#AAA' }]}>
                  {isOnline ? (isSyncing ? 'Syncing' : pendingChanges > 0 ? 'Pending' : 'Synced') : 'Offline'}
                </Text>
              </View>
            }
            isDarkMode={isDarkMode}
            showArrow={false}
          />

          {pendingChanges > 0 && (
            <SettingsItem
              title="Pending Changes"
              subtitle={`${pendingChanges} changes waiting to sync`}
              isDarkMode={isDarkMode}
              showArrow={false}
            />
          )}


          <SettingsItem
            title="Force Sync"
            subtitle={isSyncing ? "Syncing..." : "Manually sync all data now"}
            onPress={handleForceSync}
            isDarkMode={isDarkMode}
            rightComponent={
              isSyncing ? (
                <Text style={[{ color: COLORS.primary }]}>Syncing...</Text>
              ) : null
            }
          />
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection title="Appearance" isDarkMode={isDarkMode}>
          <SettingsItem
            title="Dark Mode"
            subtitle={`Toggle between light and dark theme (Current: ${isDarkMode ? 'Dark' : 'Light'})`}
            rightComponent={
              <Switch
                value={isDarkMode}
                onValueChange={(value) => {
                  console.log('🔧 Switch onValueChange called with:', value);
                  themeActions.setDarkMode(value);
                }}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
              />
            }
            isDarkMode={isDarkMode}
            showArrow={false}
          />
          
          <SettingsItem
            title="Debug Info"
            subtitle={`Theme is: ${isDarkMode ? 'Dark' : 'Light'}`}
            isDarkMode={isDarkMode}
            showArrow={false}
          />
          
          <SettingsItem
            title="Reset Theme"
            subtitle="Clear theme preference (Debug)"
            onPress={async () => {
              await themeActions.clearThemePreference();
              Alert.alert('Theme Reset', 'Theme preference cleared. App is now in light mode.');
            }}
            isDarkMode={isDarkMode}
          />
        </SettingsSection>

        {/* Data & Storage Section */}
        <SettingsSection title="Data & Storage" isDarkMode={isDarkMode}>
          <SettingsItem
            title="Clear Mock Items"
            subtitle="Remove sample data from storage"
            onPress={async () => {
              Alert.alert(
                'Clear Mock Items',
                'This will remove all sample data, keeping only your real items.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    onPress: async () => {
                      await itemsActions.clearMockItems();
                      Alert.alert('Success', 'Mock items have been cleared');
                    },
                  },
                ]
              );
            }}
            isDarkMode={isDarkMode}
          />

          <SettingsItem
            title="Clear Cache"
            subtitle="Clear locally stored data"
            onPress={handleClearCache}
            isDarkMode={isDarkMode}
          />

          <SettingsItem
            title="Export Data"
            subtitle="Download your data as JSON"
            onPress={handleExportData}
            isDarkMode={isDarkMode}
          />
        </SettingsSection>

        {/* App Info Section */}
        <SettingsSection title="About" isDarkMode={isDarkMode}>
          <SettingsItem
            title="App Version"
            subtitle={`${APP.VERSION} (${Platform.OS})`}
            isDarkMode={isDarkMode}
            showArrow={false}
          />

          <SettingsItem
            title="Help & Support"
            subtitle="Get help or contact support"
            onPress={() => Alert.alert('Coming Soon', 'Help & Support will be available soon.')}
            isDarkMode={isDarkMode}
          />
        </SettingsSection>

        {/* Change Password Modal */}
        <Modal
          visible={showChangePassword}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowChangePassword(false)}
        >
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowChangePassword(false)}
                style={styles.closeButton}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? COLORS.text.dark : COLORS.text.light}
                />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                Change Password
              </Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalDescription, isDarkMode && styles.modalDescriptionDark]}>
                Choose a new secure password for your account.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, isDarkMode && styles.inputLabelDark]}>
                  New Password
                </Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.inputDark]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, isDarkMode && styles.inputLabelDark]}>
                  Confirm New Password
                </Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.inputDark]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.changePasswordButton, isChangingPassword && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                <Text style={styles.changePasswordButtonText}>
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
});

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: UI.SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : UI.SPACING.lg,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: COLORS.text.light,
    marginBottom: UI.SPACING.xs,
  },
  titleDark: {
    color: COLORS.text.dark,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  subtitleDark: {
    color: '#AAA',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalContainerDark: {
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: UI.SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text.light,
  },
  modalTitleDark: {
    color: COLORS.text.dark,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    padding: UI.SPACING.lg,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: UI.SPACING.lg,
    lineHeight: 22,
  },
  modalDescriptionDark: {
    color: '#AAA',
  },
  inputContainer: {
    marginBottom: UI.SPACING.lg,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.light,
    marginBottom: UI.SPACING.sm,
  },
  inputLabelDark: {
    color: COLORS.text.dark,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: UI.BORDER_RADIUS,
    padding: UI.SPACING.md,
    fontSize: 16,
    backgroundColor: COLORS.background.light,
    color: COLORS.text.light,
  },
  inputDark: {
    borderColor: COLORS.border.dark,
    backgroundColor: COLORS.background.dark,
    color: COLORS.text.dark,
  },
  changePasswordButton: {
    backgroundColor: COLORS.primary,
    borderRadius: UI.BORDER_RADIUS,
    padding: UI.SPACING.md,
    alignItems: 'center',
    marginTop: UI.SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  changePasswordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
