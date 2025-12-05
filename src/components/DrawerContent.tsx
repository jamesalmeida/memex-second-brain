import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { useDrawer } from '../contexts/DrawerContext';
import { COLORS } from '../constants';
import ActionMenuConfigModal from './ActionMenuConfigModal';
import SpacesManagementModal from './SpacesManagementModal';
import { isAdminComputed } from '../utils/adminCheck';

const DrawerContentInner = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const userIsAdmin = isAdminComputed(); // Reactive check - will re-render when role changes

  console.log('🎨 [DrawerContent] Body rendered - isAdmin:', userIsAdmin);
  const {
    onSettingsPress,
    onAdminPress,
    onTagManagerPress,
    onCreateSpacePress,
    onEditSpacePress,
    onNavigateToSpace,
    onNavigateToEverything,
  } = useDrawer();

  const [isActionMenuConfigVisible, setIsActionMenuConfigVisible] = useState(false);
  const [isSpacesModalVisible, setIsSpacesModalVisible] = useState(false);


  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 70 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          {/* Everything */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('🚪 [DrawerContent] Everything pressed');
              onNavigateToEverything();
            }}
          >
            <MaterialIcons
              name="grid-view"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
              Everything
            </Text>
          </TouchableOpacity>

          {/* Spaces with New Space button */}
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              style={styles.spacesButton}
              onPress={() => setIsSpacesModalVisible(true)}
            >
              <Feather
                name="box"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
                style={styles.menuIcon}
              />
              <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
                Spaces
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, isDarkMode && styles.addButtonDark]}
              onPress={onCreateSpacePress}
            >
              <MaterialIcons
                name="add"
                size={16}
                color="#FFFFFF"
                style={styles.menuIcon}
              />
              <Text style={[styles.addButtonText, isDarkMode && styles.addButtonTextDark]}>
                New Space
              </Text>
            </TouchableOpacity>
          </View>

          {/* Manage Tags */}
          <TouchableOpacity
            style={[styles.menuItem, { marginTop: 12 }]}
            onPress={onTagManagerPress}
          >
            <MaterialIcons
              name="label"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
              Manage Tags
            </Text>
          </TouchableOpacity>

          {/* Configure Action Button */}
          <TouchableOpacity
            style={[styles.menuItem, { marginTop: 12 }]}
            onPress={() => setIsActionMenuConfigVisible(true)}
          >
            <MaterialIcons
              name="touch-app"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
              Action Button
            </Text>
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            style={[styles.menuItem, { marginTop: 12 }]}
            onPress={onSettingsPress}
          >
            <MaterialIcons
              name="settings"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
              Settings
            </Text>
          </TouchableOpacity>

          {/* Admin button - Only visible to admins */}
          {userIsAdmin && (
            <TouchableOpacity
              style={[styles.menuItem, { marginTop: 12 }]}
              onPress={onAdminPress}
            >
              <MaterialIcons
                name="build"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
                style={styles.menuIcon}
              />
              <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
                Admin
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <ActionMenuConfigModal
        visible={isActionMenuConfigVisible}
        onClose={() => setIsActionMenuConfigVisible(false)}
      />
      <SpacesManagementModal
        visible={isSpacesModalVisible}
        onClose={() => setIsSpacesModalVisible(false)}
        onNavigateToSpace={onNavigateToSpace}
        onEditSpace={onEditSpacePress}
      />
    </View>
  );
});

export const DrawerContentBody = DrawerContentInner;

interface DrawerContentProps {
  onClose: () => void;
}

const DrawerContent = ({ onClose: _onClose }: DrawerContentProps) => {
  return <DrawerContentInner />;
};

export default DrawerContent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 14,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginRight: 5,
    marginBottom: 10,
    marginTop: 10,
  },
  spacesButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginLeft: 12,
    backgroundColor: COLORS.primary,
    gap: 4,
  },
  addButtonDark: {
    backgroundColor: COLORS.primary,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextDark: {
    color: '#FFFFFF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 8,
    marginBottom: 10,
  },
  menuIcon: {
    // backgroundColor: 'blue',
  },
  menuText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000000',
    marginLeft: 10,
    textTransform: 'uppercase',
    // backgroundColor: 'red',
  },
  menuTextDark: {
    color: '#FFFFFF',
  },
});
