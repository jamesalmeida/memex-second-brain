import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';
import { themeStore } from '../stores/theme';
import { spacesComputed } from '../stores/spaces';
import { useDrawer } from '../contexts/DrawerContext';

interface DrawerContentProps {
  onClose: () => void;
}

const DrawerContent = observer(({ onClose }: DrawerContentProps) => {
  console.log('🎨 [DrawerContent] Component rendered');

  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const spaces = spacesComputed.spaces();
  const { onSettingsPress, onCreateSpacePress, onEditSpacePress } = useDrawer();

  const navigateToSpace = (spaceId: string) => {
    console.log('🚪 [DrawerContent] Navigate to space:', spaceId);
    onClose();
    // TODO: Navigate to specific space
  };

  const handleEditSpace = (spaceId: string) => {
    console.log('📝 Edit space:', spaceId);
    onEditSpacePress(spaceId);
  };

  const handleReorderSpace = (spaceId: string) => {
    console.log('🔄 Reorder space:', spaceId);
    // TODO: Implement reorder functionality
  };

  const handleDeleteSpace = (spaceId: string) => {
    console.log('🗑️ Delete space:', spaceId);
    // TODO: Implement delete functionality
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      >
        {/* Header */}
        {/* <View style={styles.header}>
          <Text style={[styles.appTitle, isDarkMode && styles.appTitleDark]}>
            Memex
          </Text>
          <Text style={[styles.appSubtitle, isDarkMode && styles.appSubtitleDark]}>
            Second Brain
          </Text>
        </View> */}

        {/* Navigation Items */}
        {/* <View style={styles.section}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('🚪 [DrawerContent] Home pressed');
              onClose();
              // Navigate to home
            }}
          >
            <MaterialIcons
              name="home"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
            />
            <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('🚪 [DrawerContent] Spaces pressed');
              onClose();
              // Navigate to spaces
            }}
          >
            <MaterialIcons
              name="dashboard"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
            />
            <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
              Spaces
            </Text>
          </TouchableOpacity>
        </View> */}

        {/* Spaces List */}
        {spaces.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                My Spaces
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={onCreateSpacePress}
              >
                <MaterialIcons
                  name="add"
                  size={20}
                  color={isDarkMode ? '#FFFFFF' : '#000000'}
                />
              </TouchableOpacity>
            </View>
            {spaces.map((space) => (
              <View key={space.id} style={styles.spaceItem}>
                <TouchableOpacity
                  style={styles.spaceItemContent}
                  onPress={() => navigateToSpace(space.id)}
                >
                  <View
                    style={[
                      styles.spaceColor,
                      { backgroundColor: space.color || '#007AFF' },
                    ]}
                  />
                  <Text
                    style={[styles.spaceText, isDarkMode && styles.spaceTextDark]}
                    numberOfLines={1}
                  >
                    {space.name}
                  </Text>
                </TouchableOpacity>
                <Host style={{ width: 24, height: 24 }}>
                  <ContextMenu>
                    <ContextMenu.Trigger>
                      <TouchableOpacity style={styles.menuDots}>
                        <MaterialIcons
                          name="more-vert"
                          size={20}
                          color={isDarkMode ? '#999' : '#666'}
                        />
                      </TouchableOpacity>
                    </ContextMenu.Trigger>
                    <ContextMenu.Items>
                      <Button onPress={() => handleEditSpace(space.id)}>
                        {`Edit ${space.name}`}
                      </Button>
                      <Button onPress={() => handleReorderSpace(space.id)}>
                        Reorder Spaces
                      </Button>
                      <Button onPress={() => handleDeleteSpace(space.id)} role="destructive">
                        Delete Space
                      </Button>
                    </ContextMenu.Items>
                  </ContextMenu>
                </Host>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky Settings at Bottom */}
      <View style={[styles.stickyFooter, isDarkMode && styles.stickyFooterDark, { paddingBottom: insets.bottom }]}>
        <View style={[styles.divider, isDarkMode && styles.dividerDark]} />
        <TouchableOpacity
          style={styles.menuItem}
          onPress={onSettingsPress}
        >
          <MaterialIcons
            name="settings"
            size={24}
            color={isDarkMode ? '#FFFFFF' : '#000000'}
          />
          <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

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
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  appTitleDark: {
    color: '#FFFFFF',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  appSubtitleDark: {
    color: '#999999',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  addButton: {
    padding: 4,
    borderRadius: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 16,
  },
  menuTextDark: {
    color: '#FFFFFF',
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  spaceItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuDots: {
    padding: 3,
  },
  spaceColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  spaceText: {
    fontSize: 15,
    color: '#000000',
    flex: 1,
  },
  spaceTextDark: {
    color: '#FFFFFF',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    // marginVertical: 20,
    marginBottom: 20,
  },
  dividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  stickyFooterDark: {
    backgroundColor: '#000000',
  },
});
