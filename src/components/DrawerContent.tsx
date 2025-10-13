import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';
import { themeStore } from '../stores/theme';
import { spacesComputed, spacesActions } from '../stores/spaces';
import { useDrawer } from '../contexts/DrawerContext';
import { syncOperations } from '../services/syncOperations';
import { authComputed } from '../stores/auth';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';

interface DrawerContentProps {
  onClose: () => void;
}

const DrawerContent = observer(({ onClose }: DrawerContentProps) => {
  console.log('🎨 [DrawerContent] Component rendered');

  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const spaces = spacesComputed.spaces();
  const { onSettingsPress, onCreateSpacePress, onEditSpacePress, onNavigateToSpace, onNavigateToEverything } = useDrawer();

  const navigateToSpace = (spaceId: string) => {
    console.log('🚪 [DrawerContent] Navigate to space:', spaceId);
    onNavigateToSpace(spaceId);
  };

  const handleEditSpace = (spaceId: string) => {
    console.log('📝 Edit space:', spaceId);
    onEditSpacePress(spaceId);
  };

  const handleDeleteSpace = (spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    Alert.alert(
      'Delete Space',
      `Are you sure you want to delete "${space.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting space:', spaceId);

              // Remove from local store first
              spacesActions.removeSpace(spaceId);

              // Sync with Supabase
              const user = authComputed.user();
              if (user) {
                await syncOperations.deleteSpace(spaceId);
                console.log('✅ Space deleted successfully');
              }
            } catch (error) {
              console.error('❌ Error deleting space:', error);
              Alert.alert('Error', 'Failed to delete space. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <DraggableFlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 100 }]}
        ListHeaderComponent={(
          <View>
            {/* Navigation Items */}
            <View style={styles.section}>
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
                />
                <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
                  Everything
                </Text>
              </TouchableOpacity>
            </View>

            {/* Spaces Header */}
            {spaces.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                  Spaces
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
            )}
          </View>
        )}
        onDragEnd={({ data }) => {
          const spacesWithOrder = data.map((space, index) => ({
            ...space,
            order_index: index,
          }));
          spacesActions.reorderSpacesWithSync(spacesWithOrder);
        }}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator>
            <View style={[styles.spaceItem, isDarkMode && styles.spaceItemDark]}>
              {/* Drag handle: press-and-hold should start drag immediately */}
              <TouchableOpacity
                onPressIn={drag}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: 4, paddingVertical: 4, marginRight: 4 }}
              >
                <MaterialIcons
                  name="drag-handle"
                  size={20}
                  color={isDarkMode ? '#999' : '#666'}
                  style={{ marginRight: 4 }}
                />
              </TouchableOpacity>

              {/* Main tap area: navigate to space */}
              <TouchableOpacity
                style={[styles.spaceItemContent, { paddingVertical: 6 }]}
                onPress={() => navigateToSpace(item.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.spaceColor,
                    { backgroundColor: item.color || '#007AFF' },
                  ]}
                />
                <Text
                  style={[styles.spaceText, isDarkMode && styles.spaceTextDark]}
                  numberOfLines={1}
                >
                  {item.name}
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
                    <Button onPress={() => handleEditSpace(item.id)}>
                      {`Edit ${item.name}`}
                    </Button>
                    <Button onPress={() => handleDeleteSpace(item.id)} role="destructive">
                      Delete Space
                    </Button>
                  </ContextMenu.Items>
                </ContextMenu>
              </Host>
            </View>
          </ScaleDecorator>
        )}
      />

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
    marginRight: 5,
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
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 10,
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
    backgroundColor: '#F5F5F5',
    marginBottom: 5,
  },
  spaceItemDark: {
    backgroundColor: '#2C2C2E',
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
