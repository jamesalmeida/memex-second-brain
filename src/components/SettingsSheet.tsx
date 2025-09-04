import React, { forwardRef, useMemo, useCallback } from 'react';
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
import { themeStore, themeActions } from '../stores/theme';
import { useAuth } from '../hooks/useAuth';
import { router } from 'expo-router';
import { COLORS, UI, APP } from '../constants';

interface SettingsSheetProps {
  // Additional props can be added here
}

const SettingsSheet = observer(
  forwardRef<BottomSheet, SettingsSheetProps>((props, ref) => {
    const { user, signOut } = useAuth();
    const isDarkMode = themeStore.isDarkMode.get();
    
    // Snap points for the bottom sheet - single point at 75%
    const snapPoints = useMemo(() => ['75%'], []);

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
                router.replace('/auth');
              } catch (error) {
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              }
            },
          },
        ]
      );
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
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
                name="science"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#333333'}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, isDarkMode && styles.rowTitleDark]}>
                  Show Demo Content
                </Text>
                <Text style={[styles.rowSubtitle, isDarkMode && styles.rowSubtitleDark]}>
                  Display example items for testing
                </Text>
              </View>
              <Switch
                value={themeStore.showMockData.get()}
                onValueChange={(value) => themeActions.setShowMockData(value)}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={themeStore.showMockData.get() ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              About
            </Text>
            
            <TouchableOpacity style={styles.row}>
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
                  {APP.VERSION}
                </Text>
              </View>
            </TouchableOpacity>

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
    paddingBottom: 40,
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
});

export default SettingsSheet;